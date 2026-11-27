import type { NextRequest } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { members, credentials } from "@/lib/db/schema";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit";
import { assertSameOrigin, badRequest, noStoreJson, withApi } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword, validateNewPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  return withApi(async () => {
    assertSameOrigin(request);
    const session = await requireApiSession(request);
    const body = await request.json().catch(() => ({}));
    const { email, currentPassword, newPassword } = body;

    const [cred] = await db
      .select({
        id: credentials.id,
        passwordHash: credentials.passwordHash,
      })
      .from(credentials)
      .where(eq(credentials.memberId, session.member.id))
      .limit(1);

    if (!cred) {
      throw badRequest("Credentials record not found for this account.");
    }

    let passwordUpdated = false;
    let emailUpdated = false;

    // Password change
    if (newPassword) {
      if (!currentPassword) {
        throw badRequest("Current password is required to set a new password.");
      }
      const isMatch = await verifyPassword(cred.passwordHash, currentPassword);
      if (!isMatch) {
        throw badRequest("Current password does not match.");
      }
      const problem = await validateNewPassword(newPassword, session.member.email);
      if (problem) {
        throw badRequest(problem);
      }
      const newHash = await hashPassword(newPassword);
      await db
        .update(credentials)
        .set({
          passwordHash: newHash,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(credentials.id, cred.id));
      passwordUpdated = true;
    }

    // Email change
    if (email && typeof email === "string" && email.trim() !== session.member.email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
        throw badRequest("Please enter a valid email address.");
      }
      const [existing] = await db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(sql`lower(${members.email})`, cleanEmail), ne(members.id, session.member.id)))
        .limit(1);

      if (existing) {
        throw badRequest("This email is already in use by another team member.");
      }

      await db
        .update(members)
        .set({
          email: cleanEmail,
          updatedAt: new Date(),
        })
        .where(eq(members.id, session.member.id));
      emailUpdated = true;
    }

    if (!passwordUpdated && !emailUpdated) {
      throw badRequest("No changes were provided.");
    }

    await db.transaction(async (tx) => {
      await writeAudit(tx, {
        memberId: session.member.id,
        action: passwordUpdated ? AUDIT_ACTIONS.passwordReset : "auth.email_updated",
        entityType: "member",
        entityId: session.member.id,
        outcome: "allowed",
        ip: session.ip,
        userAgent: session.userAgent,
        detail: { passwordUpdated, emailUpdated },
      });
    });

    return noStoreJson({
      ok: true,
      message: "Profile updated successfully.",
      emailUpdated,
      passwordUpdated,
    });
  });
}
