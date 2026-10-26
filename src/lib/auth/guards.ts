import { notFound } from "next/navigation";
import type { AuthSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS, writeAuditStandalone } from "@/lib/audit";
import { can, type Permission } from "@/lib/permissions";
import { notFound as httpNotFound } from "@/lib/http";

type Context = {
  path?: string;
  entityType?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
};

/**
 * Synchronous capability check (role matrix only). Prefer requirePermission
 * for request handling because that also writes the denied audit row.
 */
export function hasPermission(session: AuthSession, permission: Permission): boolean {
  return can(session.member.accessLevel, permission);
}

export async function auditDenial(session: AuthSession, permission: Permission, context: Context = {}): Promise<void> {
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.denied,
    entityType: context.entityType ?? "permission",
    entityId: context.entityId ?? null,
    outcome: "denied",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: {
      permission,
      path: context.path ?? null,
      ...(context.detail ?? {}),
    },
  });
  const { maybeAlertDeniedProbe } = await import("@/lib/alerts");
  void maybeAlertDeniedProbe(session.member.id);
}

/**
 * Route guard. Call before reading the request body. Signed in but not allowed
 * is deliberately 404, and always produces a denied audit row.
 */
export async function requirePermission(
  session: AuthSession,
  permission: Permission,
  context: Context = {},
): Promise<void> {
  if (can(session.member.accessLevel, permission)) return;
  await auditDenial(session, permission, context);
  throw httpNotFound();
}

/**
 * Page guard: logs every allowed and denied page view, then enforces the role
 * matrix. Returns the session for subsequent object-level checks.
 */
export async function requirePageAccess(permission: Permission, path: string): Promise<AuthSession> {
  const { requirePageSession } = await import("@/lib/auth/session");
  const session = await requirePageSession();
  const allowed = can(session.member.accessLevel, permission);
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.pageView,
    entityType: "page",
    outcome: allowed ? "allowed" : "denied",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { path, permission },
  });
  if (!allowed) notFound();
  return session;
}

export async function auditObjectDenial(
  session: AuthSession,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {},
): Promise<never> {
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.denied,
    entityType,
    entityId,
    outcome: "denied",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { objectLevel: true, ...detail },
  });
  throw httpNotFound();
}
