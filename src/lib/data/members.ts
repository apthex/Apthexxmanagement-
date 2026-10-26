import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/lib/db";
import { credentials, members, sessions } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { issueSetupToken } from "@/lib/auth/service";
import { badRequest, conflict, notFound } from "@/lib/http";
import { env } from "@/lib/env";
import { setupEmail, sendEmail } from "@/lib/email";
import { alertPrivilegeChange } from "@/lib/alerts";
import { randomToken } from "@/lib/crypto";
import type { deactivateMemberSchema, memberCreateSchema, memberUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof memberCreateSchema>;
type UpdateInput = z.infer<typeof memberUpdateSchema>;
type DeactivateInput = z.infer<typeof deactivateMemberSchema>;

export async function listMembers(session: AuthSession) {
  const owner = session.member.accessLevel === "owner";
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      roleTitle: members.roleTitle,
      accessLevel: members.accessLevel,
      joinedOn: members.joinedOn,
      status: members.status,
      lastLoginAt: owner ? members.lastLoginAt : sql<null>`null`,
      createdAt: members.createdAt,
    })
    .from(members)
    .where(isNull(members.deletedAt))
    .orderBy(members.name);

  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.memberRead,
    entityType: "member",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { mode: "list", count: rows.length },
  });
  return rows;
}

async function activeOwnerCount(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(members)
    .where(
      and(
        eq(members.accessLevel, "owner"),
        eq(members.status, "active"),
        isNull(members.deletedAt),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function createMember(session: AuthSession, input: CreateInput) {
  const existing = await db.select({ id: members.id }).from(members).where(sql`lower(${members.email}) = ${input.email}`).limit(1);
  if (existing.length) throw conflict("A member with that email already exists.");

  const setup = issueSetupToken();
  const placeholderHash = await hashPassword(randomToken(32));
  const now = new Date();
  const member = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(members)
      .values({
        name: input.name,
        email: input.email,
        roleTitle: input.roleTitle,
        accessLevel: input.accessLevel,
        joinedOn: input.joinedOn,
        status: input.status,
        createdBy: session.member.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await tx.insert(credentials).values({
      memberId: created.id,
      passwordHash: placeholderHash,
      setupTokenHash: setup.hash,
      setupExpiresAt: setup.expiresAt,
      setupPurpose: "invite",
      createdBy: session.member.id,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.memberCreate,
      entityType: "member",
      entityId: created.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: {
        after: {
          name: created.name,
          email: created.email,
          roleTitle: created.roleTitle,
          accessLevel: created.accessLevel,
          joinedOn: created.joinedOn,
          status: created.status,
        },
        inviteExpiresAt: setup.expiresAt.toISOString(),
      },
    });
    return created;
  });

  const link = `${env.appUrl}/setup?token=${encodeURIComponent(setup.token)}`;
  const email = setupEmail(member.name, link, "invite");
  const emailSent = input.status === "active" ? await sendEmail({ ...email, to: [member.email] }) : false;
  void alertPrivilegeChange(session.member.name, `New member added: ${member.name} (${member.email}), ${member.accessLevel}.`);
  return {
    member,
    emailSent,
    setupLink: env.devShowSetupLinks ? link : undefined,
  };
}

function publicMember(member: typeof members.$inferSelect) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    roleTitle: member.roleTitle,
    accessLevel: member.accessLevel,
    joinedOn: member.joinedOn,
    status: member.status,
  };
}

export async function updateMember(session: AuthSession, memberId: string, input: UpdateInput) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(members).where(and(eq(members.id, memberId), isNull(members.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();

    if (memberId === session.member.id && input.status === "inactive") {
      throw badRequest("You cannot deactivate your own account.");
    }
    if (current.accessLevel === "owner" && (input.accessLevel !== undefined && input.accessLevel !== "owner" || input.status === "inactive")) {
      if ((await activeOwnerCount()) <= 1) throw conflict("The last active owner cannot lose owner access or be deactivated.");
    }
    if (input.email && input.email !== current.email) {
      const [duplicate] = await tx
        .select({ id: members.id })
        .from(members)
        .where(sql`lower(${members.email}) = ${input.email} and ${members.id} <> ${memberId}`)
        .limit(1);
      if (duplicate) throw conflict("A member with that email already exists.");
    }

    const before = publicMember(current);
    const [updated] = await tx
      .update(members)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.roleTitle !== undefined ? { roleTitle: input.roleTitle } : {}),
        ...(input.accessLevel !== undefined ? { accessLevel: input.accessLevel } : {}),
        ...(input.joinedOn !== undefined ? { joinedOn: input.joinedOn } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberId))
      .returning();

    const revoke = (input.accessLevel !== undefined && input.accessLevel !== current.accessLevel) || input.status === "inactive";
    let revokedSessions = 0;
    if (revoke) {
      const revoked = await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.memberId, memberId), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      revokedSessions = revoked.length;
    }

    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.memberUpdate,
      entityType: "member",
      entityId: memberId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: {
        before,
        after: publicMember(updated),
        sessionsRevoked: revokedSessions,
        cloudflareAccessRemovalRequired: input.status === "inactive",
      },
    });
    return { ...publicMember(updated), sessionsRevoked: revokedSessions };
  });
}

export async function deactivateMember(session: AuthSession, memberId: string, input: DeactivateInput) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(members).where(and(eq(members.id, memberId), isNull(members.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();
    if (current.name !== input.confirmName) throw conflict("Type the member's full name exactly to confirm.");
    if (memberId === session.member.id) throw badRequest("You cannot deactivate your own account.");
    if (current.accessLevel === "owner" && (await activeOwnerCount()) <= 1) {
      throw conflict("The last active owner cannot be deactivated.");
    }
    const [updated] = await tx
      .update(members)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(members.id, memberId))
      .returning();
    const revoked = await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.memberId, memberId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.memberDeactivate,
      entityType: "member",
      entityId: memberId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: {
        memberEmail: current.email,
        sessionsRevoked: revoked.length,
        cloudflareAccessRemovalRequired: true,
      },
    });
    return { ok: true, sessionsRevoked: revoked.length };
  });
}

export async function resetMemberTwoFactor(session: AuthSession, memberId: string, confirmName: string) {
  const [member] = await db.select().from(members).where(and(eq(members.id, memberId), isNull(members.deletedAt))).limit(1);
  if (!member) throw notFound();
  if (member.name !== confirmName) throw conflict("Type the member's full name exactly to confirm.");

  const setup = issueSetupToken();
  await db.transaction(async (tx) => {
    await tx
      .update(credentials)
      .set({
        totpSecret: null,
        totpEnrolledAt: null,
        recoveryCodeHashes: [],
        recoveryCodesUsed: 0,
        lastTotpStep: null,
        setupTokenHash: setup.hash,
        setupExpiresAt: setup.expiresAt,
        setupPurpose: "invite",
        updatedAt: new Date(),
      })
      .where(eq(credentials.memberId, memberId));
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.memberId, memberId), isNull(sessions.revokedAt)));
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.totpReset,
      entityType: "member",
      entityId: memberId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { subjectMemberId: memberId, sessionsRevoked: true },
    });
  });

  const link = `${env.appUrl}/setup?token=${encodeURIComponent(setup.token)}`;
  const emailSent = await sendEmail({ ...setupEmail(member.name, link, "invite"), to: [member.email] });
  await writeAuditStandalone({
    memberId: session.member.id,
    action: "member.invite_sent",
    entityType: "member",
    entityId: memberId,
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { purpose: "password_and_2fa_reset", emailSent },
  });
  return { ok: true, emailSent, setupLink: env.devShowSetupLinks ? link : undefined };
}
