import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { auditEvents, credentials, members, rateLimits, sessions, type Member } from "@/lib/db/schema";
import { createSession, type CreatedSession } from "@/lib/auth/session";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/auth/password";
import {
  currentStep,
  generateRecoveryCodes,
  generateTotpSecret,
  normaliseRecoveryCode,
  totpUri,
  verifyTotp,
} from "@/lib/auth/totp";
import { decryptSecret, encryptSecret, tokenHash, randomToken, sha256 } from "@/lib/crypto";
import { env, SESSION_ABSOLUTE_MS } from "@/lib/env";
import { HttpError, badRequest, requestIp, requestUserAgent } from "@/lib/http";
import { consumeRateLimit, readRateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import {
  alertFailedLogins,
  alertLocked,
  alertNewDevice,
  alertOutsideHours,
  istHour,
} from "@/lib/alerts";

const ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 30;
const LOCK_MS = 30 * 60 * 1000;
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$xI35+MiEN46rS8zoT1YsrQ$8mlsXONJADNmJLwgn/JXaYZYNEvFO3UMZgHdM0B8hBU";
const GENERIC_FAILURE = "Those details didn't work.";

type LoginContext = { ip: string; userAgent: string };

export type LoginResult = CreatedSession & {
  memberId: string;
  accessLevel: Member["accessLevel"];
  name: string;
};

function authFailure(status = 401): HttpError {
  return new HttpError(status, GENERIC_FAILURE, "auth_failed");
}

async function auditFailure(
  memberId: string | null,
  email: string,
  context: LoginContext,
  reason: string,
  attempts: number,
): Promise<void> {
  await writeAuditStandalone({
    memberId,
    action: AUDIT_ACTIONS.loginFailed,
    entityType: "auth",
    outcome: "denied",
    ip: context.ip,
    userAgent: context.userAgent,
    detail: { email, reason, attempts },
  });
}

async function findMemberWithCredentials(email: string) {
  const [row] = await db
    .select({ member: members, credential: credentials })
    .from(members)
    .leftJoin(credentials, eq(credentials.memberId, members.id))
    .where(and(sql`lower(${members.email}) = ${email}`, isNull(members.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Password + TOTP/recovery in one submit. Every failure mode returns the same
 * message. Successful session creation, replay protection and the login audit
 * row share one transaction.
 */
export async function login(emailInput: string, password: string, code: string, context: LoginContext): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase();
  const ipKey = `login:ip:${context.ip}`;
  const accountKey = `login:account:${email}`;

  const ipCount = await readRateLimit(ipKey, IP_WINDOW_MS);
  if (ipCount >= IP_LIMIT) {
    await auditFailure(null, email, context, "ip_rate_limited", ipCount);
    throw authFailure(429);
  }

  const existingAccountCount = await readRateLimit(accountKey, ACCOUNT_WINDOW_MS);
  if (existingAccountCount >= ACCOUNT_LIMIT) {
    await auditFailure(null, email, context, "account_rate_limited", existingAccountCount);
    throw authFailure();
  }

  const row = await findMemberWithCredentials(email);
  const credential = row?.credential ?? null;

  // Equalise unknown-email timing.
  const passwordOk = credential
    ? await verifyPassword(credential.passwordHash, password)
    : (await verifyPassword(DUMMY_HASH, password), false);

  const locked = credential?.lockedUntil ? credential.lockedUntil.getTime() > Date.now() : false;
  if (!row || row.member.status !== "active" || row.member.deletedAt || !credential || !passwordOk || locked) {
    const reason = !row ? "unknown_account" : row.member.status !== "active" ? "inactive" : locked ? "locked" : "password";
    await registerFailure(email, row?.member.id ?? null, credential?.id ?? null, context, reason, locked);
    throw authFailure();
  }

  const totpCode = code.replace(/\s/g, "");
  const isRecovery = /[A-Za-z-]/.test(totpCode) && totpCode.length > 6;
  let totpStep: number | null = null;
  let recoveryHash: string | null = null;

  if (env.totpRequired) {
    if (!credential.totpSecret || !credential.totpEnrolledAt) {
      await registerFailure(email, row.member.id, credential.id, context, "totp_not_enrolled");
      throw authFailure();
    }
    if (isRecovery) {
      const normalised = normaliseRecoveryCode(totpCode);
      recoveryHash = tokenHash(normalised, env.tokenPepper);
      if (!credential.recoveryCodeHashes.includes(recoveryHash)) {
        await registerFailure(email, row.member.id, credential.id, context, "recovery_code");
        throw authFailure();
      }
    } else {
      const secret = decryptSecret(credential.totpSecret, env.encryptionKey);
      totpStep = verifyTotp(secret, totpCode);
      if (totpStep === null || (credential.lastTotpStep !== null && totpStep <= credential.lastTotpStep)) {
        await registerFailure(email, row.member.id, credential.id, context, "totp");
        throw authFailure();
      }
    }
  }

  // Previous successful sign-in determines the new-device alert.
  const [previous] = await db
    .select({ ip: auditEvents.ip, userAgent: auditEvents.userAgent })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.memberId, row.member.id),
        eq(auditEvents.action, AUDIT_ACTIONS.login),
        eq(auditEvents.outcome, "allowed"),
      ),
    )
    .orderBy(desc(auditEvents.occurredAt))
    .limit(1);
  const newDevice =
    !previous || previous.ip !== context.ip || (previous.userAgent ?? "") !== (context.userAgent ?? "");
  const outOfHours = istHour() < 7 || istHour() >= 23;

  let result: LoginResult;
  try {
    result = await db.transaction(async (tx) => {
      if (recoveryHash) {
        const [current] = await tx
          .select({
            hashes: credentials.recoveryCodeHashes,
            used: credentials.recoveryCodesUsed,
            lockedUntil: credentials.lockedUntil,
          })
          .from(credentials)
          .where(eq(credentials.id, credential.id))
          .for("update")
          .limit(1);
        if (!current || !current.hashes.includes(recoveryHash) || (current.lockedUntil && current.lockedUntil > new Date())) {
          throw authFailure();
        }
        await tx
          .update(credentials)
          .set({
            recoveryCodeHashes: current.hashes.filter((hash) => hash !== recoveryHash),
            recoveryCodesUsed: current.used + 1,
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(credentials.id, credential.id));
      } else {
        const [updated] = await tx
          .update(credentials)
          .set({
            lastTotpStep: totpStep ?? credential.lastTotpStep,
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(credentials.id, credential.id),
              totpStep === null
                ? undefined
                : sql`(${credentials.lastTotpStep} is null or ${credentials.lastTotpStep} < ${totpStep})`,
            ),
          )
          .returning({ id: credentials.id });
        if (!updated) throw authFailure();
      }

      await tx.update(members).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(members.id, row.member.id));
      await tx.delete(rateLimits).where(eq(rateLimits.key, accountKey));

      const created = await createSession(
        row.member.id,
        { ip: context.ip, userAgent: context.userAgent },
        tx,
      );

      await writeAudit(tx, {
        memberId: row.member.id,
        action: AUDIT_ACTIONS.login,
        entityType: "auth",
        entityId: row.member.id,
        outcome: "allowed",
        ip: context.ip,
        userAgent: context.userAgent,
        detail: {
          method: recoveryHash ? "recovery_code" : env.totpRequired ? "password+totp" : "password",
          newDevice,
        },
      });

      return {
        ...created,
        memberId: row.member.id,
        accessLevel: row.member.accessLevel,
        name: row.member.name,
      };
    });
  } catch (error) {
    if (error instanceof HttpError) {
      await registerFailure(email, row.member.id, credential.id, context, "replay_or_race");
    }
    throw error instanceof HttpError ? error : authFailure();
  }

  if (newDevice) void alertNewDevice(row.member.name, row.member.email, context.ip, context.userAgent);
  if (outOfHours) void alertOutsideHours(row.member.name, row.member.email, context.ip);
  return result;
}

async function registerFailure(
  email: string,
  memberId: string | null,
  credentialId: string | null,
  context: LoginContext,
  reason: string,
  alreadyLocked = false,
): Promise<void> {
  const accountKey = `login:account:${email}`;
  const ipKey = `login:ip:${context.ip}`;
  const [account, ip] = await Promise.all([
    consumeRateLimit(accountKey, ACCOUNT_LIMIT, ACCOUNT_WINDOW_MS),
    consumeRateLimit(ipKey, IP_LIMIT, IP_WINDOW_MS),
  ]);

  if (credentialId && !alreadyLocked) {
    const lockUntil = account.count >= ACCOUNT_LIMIT ? new Date(Date.now() + LOCK_MS) : null;
    await db
      .update(credentials)
      .set({
        failedAttempts: account.count,
        lockedUntil: lockUntil,
        updatedAt: new Date(),
      })
      .where(eq(credentials.id, credentialId));
    if (lockUntil) {
      await writeAuditStandalone({
        memberId,
        action: AUDIT_ACTIONS.loginLocked,
        entityType: "auth",
        outcome: "denied",
        ip: context.ip,
        userAgent: context.userAgent,
        detail: { email, attempts: account.count, lockedMinutes: 30 },
      });
      void alertLocked(email, context.ip);
    }
  }

  await auditFailure(memberId, email, context, reason, account.count);

  if (account.count === 3) {
    void alertFailedLogins(email, account.count, context.ip, context.userAgent);
  }

  if (!ip.allowed) {
    throw authFailure(429);
  }
}

export type SetupInfo = {
  mode: "invite" | "reset";
  stage: "password" | "confirm";
  name: string;
  email: string;
  otpauth?: string;
  qrDataUrl?: string;
};

async function findSetup(token: string) {
  const hash = tokenHash(token, env.tokenPepper);
  const [row] = await db
    .select({ member: members, credential: credentials })
    .from(credentials)
    .innerJoin(members, eq(credentials.memberId, members.id))
    .where(
      and(
        eq(credentials.setupTokenHash, hash),
        gt(credentials.setupExpiresAt, new Date()),
        isNull(members.deletedAt),
        eq(members.status, "active"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getSetupInfo(token: string): Promise<SetupInfo | null> {
  const row = await findSetup(token);
  if (!row || !row.credential.setupPurpose) return null;
  const mode = row.credential.setupPurpose;
  if (mode === "reset") {
    return { mode, stage: "password", name: row.member.name, email: row.member.email };
  }
  if (!row.credential.totpSecret) {
    return { mode, stage: "password", name: row.member.name, email: row.member.email };
  }
  const secret = decryptSecret(row.credential.totpSecret, env.encryptionKey);
  const uri = totpUri(secret, row.member.email, env.totpIssuer);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: "M" });
  return {
    mode,
    stage: "confirm",
    name: row.member.name,
    email: row.member.email,
    otpauth: uri,
    qrDataUrl,
  };
}

type SetupPasswordResult =
  | { mode: "reset"; completed: true }
  | { mode: "invite"; completed: false; otpauth: string; qrDataUrl: string };

/**
 * Invite: set/replace password, create and encrypt a TOTP secret, keep the
 * single-use token until the authenticator code is confirmed.
 * Reset: change password, consume the token, revoke every session.
 */
export async function setSetupPassword(token: string, password: string): Promise<SetupPasswordResult> {
  const row = await findSetup(token);
  if (!row || !row.credential.setupPurpose) throw badRequest("This link is invalid or has expired.");
  const problem = await validateNewPassword(password, row.member.email);
  if (problem) throw badRequest(problem);

  if (row.credential.setupPurpose === "reset") {
    await db.transaction(async (tx) => {
      await tx
        .update(credentials)
        .set({
          passwordHash: await hashPassword(password),
          setupTokenHash: null,
          setupExpiresAt: null,
          setupPurpose: null,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(credentials.id, row.credential.id));
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.memberId, row.member.id), isNull(sessions.revokedAt)));
      await writeAudit(tx, {
        memberId: row.member.id,
        action: AUDIT_ACTIONS.passwordReset,
        entityType: "auth",
        entityId: row.member.id,
        outcome: "allowed",
        ip: "setup",
        detail: { sessionsRevoked: true },
      });
      await tx.update(members).set({ updatedAt: new Date() }).where(eq(members.id, row.member.id));
    });
    return { mode: "reset", completed: true };
  }

  let secret = row.credential.totpSecret ? decryptSecret(row.credential.totpSecret, env.encryptionKey) : null;
  if (!secret) {
    secret = generateTotpSecret();
    await db.transaction(async (tx) => {
      await tx
        .update(credentials)
        .set({
          passwordHash: await hashPassword(password),
          totpSecret: encryptSecret(secret!, env.encryptionKey),
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(credentials.id, row.credential.id));
      await writeAudit(tx, {
        memberId: row.member.id,
        action: AUDIT_ACTIONS.setup,
        entityType: "auth",
        entityId: row.member.id,
        outcome: "allowed",
        ip: "setup",
        detail: { stage: "password_set" },
      });
    });
  } else {
    await db.transaction(async (tx) => {
      await tx
        .update(credentials)
        .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
        .where(eq(credentials.id, row.credential.id));
      await writeAudit(tx, {
        memberId: row.member.id,
        action: AUDIT_ACTIONS.setup,
        entityType: "auth",
        entityId: row.member.id,
        outcome: "allowed",
        ip: "setup",
        detail: { stage: "password_updated" },
      });
    });
  }

  const uri = totpUri(secret, row.member.email, env.totpIssuer);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: "M" });
  return { mode: "invite", completed: false, otpauth: uri, qrDataUrl };
}

export async function confirmSetup(token: string, code: string): Promise<{ recoveryCodes: string[] }> {
  const row = await findSetup(token);
  if (
    !row ||
    row.credential.setupPurpose !== "invite" ||
    !row.credential.totpSecret
  ) {
    throw badRequest("This link is invalid or has expired.");
  }
  const secret = decryptSecret(row.credential.totpSecret, env.encryptionKey);
  const step = verifyTotp(secret, code);
  if (step === null) throw badRequest("That code didn't work. Check your authenticator and try again.");

  const recoveryCodes = generateRecoveryCodes(10);
  const hashes = recoveryCodes.map((recoveryCode) =>
    tokenHash(normaliseRecoveryCode(recoveryCode), env.tokenPepper),
  );

  await db.transaction(async (tx) => {
    await tx
      .update(credentials)
      .set({
        totpEnrolledAt: new Date(),
        // The enrolment code is deliberately not marked as consumed here:
        // the member may sign in within the same 30-second window. Login
        // replay protection takes over immediately after this step.
        lastTotpStep: step - 1,
        recoveryCodeHashes: hashes,
        recoveryCodesUsed: 0,
        setupTokenHash: null,
        setupExpiresAt: null,
        setupPurpose: null,
        updatedAt: new Date(),
      })
      .where(eq(credentials.id, row.credential.id));
    await writeAudit(tx, {
      memberId: row.member.id,
      action: AUDIT_ACTIONS.totpEnrolled,
      entityType: "auth",
      entityId: row.member.id,
      outcome: "allowed",
      ip: "setup",
      detail: { recoveryCodesIssued: 10 },
    });
  });

  return { recoveryCodes };
}

/**
 * Always returns the same public result, even for an unknown account. The
 * stored token is single-use and expires in 24 hours.
 */
export async function requestPasswordReset(
  emailInput: string,
  context: LoginContext,
): Promise<{ link?: string }> {
  const email = emailInput.trim().toLowerCase();
  const ipLimit = await consumeRateLimit(`reset:ip:${context.ip}`, 10, 60 * 60 * 1000);
  const accountLimit = await consumeRateLimit(`reset:account:${email}`, 5, 60 * 60 * 1000);
  if (!ipLimit.allowed || !accountLimit.allowed) return {};

  const row = await findMemberWithCredentials(email);
  if (!row || !row.credential || row.member.status !== "active" || row.member.deletedAt) {
    await writeAuditStandalone({
      memberId: null,
      action: "auth.reset_requested",
      entityType: "auth",
      outcome: "denied",
      ip: context.ip,
      userAgent: context.userAgent,
      detail: { email, accountExists: false },
    });
    return {};
  }

  const token = randomToken(32);
  const link = `${env.appUrl}/setup?token=${encodeURIComponent(token)}`;
  const credentialId = row.credential.id;
  await db.transaction(async (tx) => {
    await tx
      .update(credentials)
      .set({
        setupTokenHash: tokenHash(token, env.tokenPepper),
        setupExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        setupPurpose: "reset",
        updatedAt: new Date(),
      })
      .where(eq(credentials.id, credentialId));
    await writeAudit(tx, {
      memberId: row.member.id,
      action: "auth.reset_requested",
      entityType: "auth",
      entityId: row.member.id,
      outcome: "allowed",
      ip: context.ip,
      userAgent: context.userAgent,
      detail: { accountExists: true, expiresHours: 24 },
    });
  });

  const { setupEmail, sendEmail } = await import("@/lib/email");
  await sendEmail({ ...setupEmail(row.member.name, link, "reset"), to: [row.member.email] });
  return env.devShowSetupLinks ? { link } : {};
}

/** Used by owner-initiated invites and 2FA resets. */
export function issueSetupToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomToken(32);
  return {
    token,
    hash: tokenHash(token, env.tokenPepper),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

export async function ownerReenrollMember(memberId: string): Promise<{ token: string; link: string }> {
  const token = issueSetupToken();
  await db.transaction(async (tx) => {
    await tx
      .update(credentials)
      .set({
        totpSecret: null,
        totpEnrolledAt: null,
        recoveryCodeHashes: [],
        recoveryCodesUsed: 0,
        lastTotpStep: null,
        setupTokenHash: token.hash,
        setupExpiresAt: token.expiresAt,
        setupPurpose: "invite",
        updatedAt: new Date(),
      })
      .where(eq(credentials.memberId, memberId));
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.memberId, memberId), isNull(sessions.revokedAt)));
  });
  return { token: token.token, link: `${env.appUrl}/setup?token=${encodeURIComponent(token.token)}` };
}

export async function cleanupRateLimits(): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

export { GENERIC_FAILURE };
