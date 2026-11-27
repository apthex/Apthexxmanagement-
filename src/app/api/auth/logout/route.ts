import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { SESSION_COOKIE } from "@/lib/env";
import { AUDIT_ACTIONS, writeAuditStandalone } from "@/lib/audit";
import { noStoreJson, requestIp, requestUserAgent } from "@/lib/http";
import { loadSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const token =
      authHeader ||
      request.cookies.get("apt_session")?.value ||
      request.cookies.get("__Host-apt_session")?.value ||
      request.cookies.get(SESSION_COOKIE)?.value ||
      undefined;

    if (token) {
      const session = await loadSession(token, {
        ip: requestIp(request.headers),
        userAgent: requestUserAgent(request.headers),
      }).catch(() => null);

      if (session) {
        await db
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(sessions.id, session.sessionId), eq(sessions.memberId, session.member.id)))
          .catch(() => {});

        await writeAuditStandalone({
          memberId: session.member.id,
          action: AUDIT_ACTIONS.logout,
          entityType: "auth",
          entityId: session.member.id,
          outcome: "allowed",
          ip: session.ip,
          userAgent: session.userAgent,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[logout] Non-critical warning:", err);
  }

  const response = noStoreJson({ ok: true, logged_out: true });
  const cookieNames = ["apt_session", "__Host-apt_session", SESSION_COOKIE, "apt_csrf"];
  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}
