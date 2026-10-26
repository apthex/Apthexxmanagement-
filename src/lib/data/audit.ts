import { and, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, members } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS, writeAuditStandalone } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { formatIstDateTime } from "@/lib/dates";
import { alertExport } from "@/lib/alerts";

export type AuditFilters = {
  memberId?: string;
  action?: string;
  outcome?: "allowed" | "denied";
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

function whereFor(filters: AuditFilters) {
  const term = filters.q?.trim();
  const fromDate = filters.from ? new Date(`${filters.from}T00:00:00+05:30`) : undefined;
  const toDate = filters.to ? new Date(`${filters.to}T00:00:00+05:30`) : undefined;
  if (toDate) toDate.setUTCDate(toDate.getUTCDate() + 1);

  return and(
    filters.memberId ? eq(auditEvents.memberId, filters.memberId) : undefined,
    filters.action ? eq(auditEvents.action, filters.action) : undefined,
    filters.outcome ? eq(auditEvents.outcome, filters.outcome) : undefined,
    fromDate ? gte(auditEvents.occurredAt, fromDate) : undefined,
    toDate ? lt(auditEvents.occurredAt, toDate) : undefined,
    term
      ? or(
          ilike(auditEvents.action, `%${term}%`),
          ilike(auditEvents.entityType, `%${term}%`),
          ilike(auditEvents.ip, `%${term}%`),
          ilike(auditEvents.userAgent, `%${term}%`),
          ilike(members.email, `%${term}%`),
          ilike(members.name, `%${term}%`),
          sql`${auditEvents.detail}::text ilike ${`%${term}%`}`,
        )
      : undefined,
  );
}

export async function listAuditEvents(session: AuthSession, filters: AuditFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const where = whereFor(filters);

  const [totalRow] = await db.select({ n: count() }).from(auditEvents).leftJoin(members, eq(auditEvents.memberId, members.id)).where(where);
  const rows = await db
    .select({
      id: auditEvents.id,
      occurredAt: auditEvents.occurredAt,
      memberId: auditEvents.memberId,
      memberName: members.name,
      memberEmail: members.email,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      outcome: auditEvents.outcome,
      ip: auditEvents.ip,
      userAgent: auditEvents.userAgent,
      detail: auditEvents.detail,
    })
    .from(auditEvents)
    .leftJoin(members, eq(auditEvents.memberId, members.id))
    .where(where)
    .orderBy(desc(auditEvents.occurredAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const total = Number(totalRow?.n ?? 0);
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.auditRead,
    entityType: "audit",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { page, pageSize, total, filters: { ...filters, page: undefined, pageSize: undefined } },
  });

  return {
    events: rows,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function exportAuditCsv(session: AuthSession, filters: AuditFilters) {
  const where = whereFor(filters);
  const rows = await db
    .select({
      occurredAt: auditEvents.occurredAt,
      memberEmail: members.email,
      memberName: members.name,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      outcome: auditEvents.outcome,
      ip: auditEvents.ip,
      userAgent: auditEvents.userAgent,
      detail: auditEvents.detail,
    })
    .from(auditEvents)
    .leftJoin(members, eq(auditEvents.memberId, members.id))
    .where(where)
    .orderBy(desc(auditEvents.occurredAt))
    .limit(50_000);

  const content = toCsv(
    ["timestamp_ist", "member", "email", "action", "entity_type", "entity_id", "outcome", "ip", "user_agent", "detail"],
    rows.map((row) => [
      formatIstDateTime(row.occurredAt),
      row.memberName,
      row.memberEmail,
      row.action,
      row.entityType,
      row.entityId,
      row.outcome,
      row.ip,
      row.userAgent,
      JSON.stringify(row.detail),
    ]),
  );

  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.export,
    entityType: "audit",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { rows: rows.length, format: "csv", filters: { ...filters, page: undefined, pageSize: undefined } },
  });
  void alertExport(session.member.name, "audit log", rows.length, session.ip);
  return { content, rowCount: rows.length, filename: `apthex-audit-${new Date().toISOString().slice(0, 10)}.csv` };
}
