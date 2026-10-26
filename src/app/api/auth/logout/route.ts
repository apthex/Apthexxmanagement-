import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { SESSION_COOKIE } from "@/lib/env";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit";
import { assertSameOrigin, noStoreJson, withApi } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApi(async () => {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    await db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.id, session.sessionId), eq(sessions.memberId, session.member.id)));
      await writeAudit(tx, {
        memberId: session.member.id,
        action: AUDIT_ACTIONS.logout,
        entityType: "auth",
        entityId: session.member.id,
        outcome: "allowed",
        ip: session.ip,
        userAgent: session.userAgent,
      });
    });
    const response = noStoreJson({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  });
}
