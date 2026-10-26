import type { AppDatabase } from "@/lib/db";
import { db } from "@/lib/db";
import { auditEvents, type AuditOutcome } from "@/lib/db/schema";

export const AUDIT_ACTIONS = {
  login: "auth.login",
  loginFailed: "auth.fail",
  loginLocked: "auth.locked",
  logout: "auth.logout",
  setup: "auth.setup",
  passwordReset: "auth.password_reset",
  totpEnrolled: "auth.2fa_enrolled",
  totpReset: "auth.2fa_reset",
  pageView: "page.view",
  denied: "permission.denied",
  export: "data.export",
  leadCreate: "lead.create",
  leadUpdate: "lead.update",
  leadDelete: "lead.delete",
  leadStage: "lead.stage",
  leadRead: "lead.read",
  leadConvert: "lead.convert",
  clientCreate: "client.create",
  clientUpdate: "client.update",
  clientRead: "client.read",
  clientAssign: "client.assign",
  clientUnassign: "client.unassign",
  taskCreate: "task.create",
  taskUpdate: "task.update",
  taskRead: "task.read",
  taskComment: "task.comment",
  worklogCreate: "worklog.create",
  worklogUpdate: "worklog.update",
  worklogRate: "worklog.rate",
  worklogRead: "worklog.read",
  meetingCreate: "meeting.create",
  meetingUpdate: "meeting.update",
  meetingRead: "meeting.read",
  financeCreate: "finance.create",
  financeUpdate: "finance.update",
  financeReverse: "finance.reverse",
  financeRead: "finance.read",
  memberCreate: "member.create",
  memberUpdate: "member.update",
  memberDeactivate: "member.deactivate",
  memberRead: "member.read",
  auditRead: "audit.read",
  livewebRead: "liveweb.read",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | (string & {});

export type AuditInput = {
  memberId: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  outcome: AuditOutcome;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
};

type Executor = Pick<AppDatabase, "insert">;

/**
 * Writes an audit row using the supplied transaction. Callers performing a
 * successful write MUST pass their transaction so evidence and action commit
 * or roll back together. Throws if the insert fails.
 */
export async function writeAudit(executor: Executor, input: AuditInput): Promise<void> {
  await executor.insert(auditEvents).values({
    memberId: input.memberId,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    outcome: input.outcome,
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 512) ?? null,
    detail: input.detail ?? {},
  });
}

/**
 * Denials and failures must survive an action rollback, so they are written in
 * their own transaction. Never let a failed audit insert crash the 404 path;
 * log it server-side instead.
 */
export async function writeAuditStandalone(input: AuditInput): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await writeAudit(tx, input);
    });
  } catch (error) {
    console.error("[audit] failed to persist standalone event", input.action, error instanceof Error ? error.message : error);
  }
}

/** Strip secrets, tokens and hashes from detail objects. */
export function safeDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const blocked = /(password|token|secret|hash|code)/i;
  return Object.fromEntries(
    Object.entries(detail).filter(([key]) => !blocked.test(key)).map(([key, value]) => [key, value ?? null]),
  );
}
