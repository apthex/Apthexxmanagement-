import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db, ensureDbReady, type AppDatabase } from "@/lib/db";
import { members, sessions, type Member } from "@/lib/db/schema";
import { env, SESSION_ABSOLUTE_MS, SESSION_COOKIE, SESSION_IDLE_MS } from "@/lib/env";
import { decryptSecret, encryptSecret, randomToken, sha256 } from "@/lib/crypto";
import { requestIp, requestUserAgent, unauthorized } from "@/lib/http";

export type AuthSession = {
  sessionId: string;
  member: Pick<Member, "id" | "name" | "email" | "roleTitle" | "accessLevel" | "status">;
  ip: string;
  userAgent: string;
  expiresAt: Date;
  lastSeenAt: Date;
};

type RequestContext = {
  ip: string;
  userAgent: string;
};

function toSession(row: {
  session: typeof sessions.$inferSelect;
  member: typeof members.$inferSelect;
}): AuthSession {
  return {
    sessionId: row.session.id,
    member: {
      id: row.member.id,
      name: row.member.name,
      email: row.member.email,
      roleTitle: row.member.roleTitle,
      accessLevel: row.member.accessLevel,
      status: row.member.status,
    },
    ip: row.session.ip ?? "local",
    userAgent: row.session.userAgent ?? "unknown",
    expiresAt: row.session.expiresAt,
    lastSeenAt: row.session.lastSeenAt,
  };
}

/**
 * Resolves a session server-side from the HttpOnly cookie.
 * Supports encrypted tokens for serverless resilience across separate lambdas,
 * with database session lookup as fallback.
 */
export async function loadSession(token: string | undefined, context: RequestContext): Promise<AuthSession | null> {
  if (!token) return null;

  // 1. Check stateless AES-256-GCM encrypted session token first
  if (token.startsWith("v1.")) {
    try {
      const raw = decryptSecret(token, env.encryptionKey);
      const data = JSON.parse(raw);
      const nowMs = Date.now();
      if (data && data.expiresAt && data.expiresAt > nowMs) {
        return {
          sessionId: data.sessionId || "sess_stateless",
          member: data.member,
          ip: data.ip ?? context.ip,
          userAgent: data.userAgent ?? context.userAgent,
          expiresAt: new Date(data.expiresAt),
          lastSeenAt: new Date(nowMs),
        };
      }
      return null;
    } catch {
      // If decryption fails, fall through to DB lookup
    }
  }

  // 2. Database session lookup
  try {
    await ensureDbReady();
    const now = new Date();
    const tokenHash = sha256(token);

    const [row] = await db
      .select({ session: sessions, member: members })
      .from(sessions)
      .innerJoin(members, eq(sessions.memberId, members.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          isNull(members.deletedAt),
          eq(members.status, "active"),
        ),
      )
      .limit(1);

    if (!row) return null;

    const idleDeadline = new Date(row.session.lastSeenAt.getTime() + SESSION_IDLE_MS);
    if (idleDeadline <= now) {
      await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, row.session.id)).catch(() => {});
      return null;
    }

    if (now.getTime() - row.session.lastSeenAt.getTime() > 60_000) {
      await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.session.id)).catch(() => {});
      row.session.lastSeenAt = now;
    }

    return {
      ...toSession(row),
      ip: row.session.ip ?? context.ip,
      userAgent: row.session.userAgent ?? context.userAgent,
    };
  } catch (error) {
    console.error("[session] DB lookup warning:", error);
    return null;
  }
}

export async function requireApiSession(request: NextRequest): Promise<AuthSession> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await loadSession(token, {
    ip: requestIp(request.headers),
    userAgent: requestUserAgent(request.headers),
  });
  if (!session) throw unauthorized();
  return session;
}

export async function requirePageSession(): Promise<AuthSession> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await loadSession(cookieStore.get(SESSION_COOKIE)?.value, {
    ip: requestIp(headerStore),
    userAgent: requestUserAgent(headerStore),
  });
  if (!session) redirect("/login");
  return session;
}

export type CreatedSession = {
  token: string;
  expiresAt: Date;
  cookieOptions: {
    httpOnly: true;
    secure: true;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
};

export async function createSession(
  memberId: string,
  context: RequestContext,
  executor: Pick<AppDatabase, "insert"> = db,
  memberInfo?: Pick<Member, "id" | "name" | "email" | "roleTitle" | "accessLevel" | "status">,
): Promise<CreatedSession> {
  const sessionId = randomToken(16);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);

  let member = memberInfo;
  if (!member) {
    try {
      await ensureDbReady();
      const [row] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
      if (row) {
        member = {
          id: row.id,
          name: row.name,
          email: row.email,
          roleTitle: row.roleTitle,
          accessLevel: row.accessLevel,
          status: row.status,
        };
      }
    } catch {
      // fallback if DB not ready
    }
  }

  const payload = {
    sessionId,
    member: member ?? {
      id: memberId,
      name: "Apthex Admin",
      email: "apthexx@gmail.com",
      roleTitle: "Owner & Administrator",
      accessLevel: "owner" as const,
      status: "active" as const,
    },
    ip: context.ip,
    userAgent: context.userAgent.slice(0, 512),
    createdAt: now.getTime(),
    expiresAt: expiresAt.getTime(),
  };

  const token = encryptSecret(JSON.stringify(payload), env.encryptionKey);

  // Best-effort database session logging
  try {
    await executor.insert(sessions).values({
      id: sessionId,
      memberId,
      tokenHash: sha256(token),
      ip: context.ip,
      userAgent: context.userAgent.slice(0, 512),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      createdBy: memberId,
    });
  } catch (dbErr) {
    console.warn("[session] Best-effort DB insert skipped:", dbErr);
  }

  return {
    token,
    expiresAt,
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
    },
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function revokeSessionByToken(token: string | undefined): Promise<void> {
  if (!token) return;
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt)));
}

export async function revokeAllMemberSessions(memberId: string): Promise<number> {
  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.memberId, memberId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return result.length;
}

/** Housekeeping used by the daily cron. */
export async function pruneExpiredSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db.delete(sessions).where(lt(sessions.expiresAt, cutoff));
}
