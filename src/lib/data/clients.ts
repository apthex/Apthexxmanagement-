import { and, desc, eq, exists, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientAssignments, clients, meetings, members } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { auditObjectDenial } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/http";
import type { assignmentSchema, clientCreateSchema, clientUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof clientCreateSchema>;
type UpdateInput = z.infer<typeof clientUpdateSchema>;
type AssignmentInput = z.infer<typeof assignmentSchema>;

function assignedToMe(clientIdColumn: typeof clients.id, memberId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(clientAssignments)
      .where(
        and(
          eq(clientAssignments.clientId, clientIdColumn),
          eq(clientAssignments.memberId, memberId),
          isNull(clientAssignments.removedAt),
          isNull(clientAssignments.deletedAt),
        ),
      ),
  );
}

export function clientScope(session: AuthSession) {
  if (session.member.accessLevel === "team") {
    return assignedToMe(clients.id, session.member.id);
  }
  return undefined;
}

export async function canReadClient(session: AuthSession, clientId: string): Promise<boolean> {
  if (session.member.accessLevel !== "team") return true;
  const [row] = await db
    .select({ id: clientAssignments.id })
    .from(clientAssignments)
    .where(
      and(
        eq(clientAssignments.clientId, clientId),
        eq(clientAssignments.memberId, session.member.id),
        isNull(clientAssignments.removedAt),
        isNull(clientAssignments.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function requireClientRead(session: AuthSession, clientId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1);
  if (!client) throw notFound();
  if (!(await canReadClient(session, clientId))) {
    return auditObjectDenial(session, "client", clientId, { module: "clients" });
  }
  return client;
}

async function logRead(session: AuthSession, entityId: string | null, detail: Record<string, unknown>) {
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.clientRead,
    entityType: "client",
    entityId,
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail,
  });
}

export async function listClients(session: AuthSession, search = "") {
  const term = search.trim();
  const rows = await db
    .select({
      id: clients.id,
      company: clients.company,
      ownerMemberId: clients.ownerMemberId,
      ownerName: members.name,
      serviceType: clients.serviceType,
      agreementStatus: clients.agreementStatus,
      status: clients.status,
      contactName: clients.contactName,
      contactEmail: clients.contactEmail,
      updatedAt: clients.updatedAt,
    })
    .from(clients)
    .innerJoin(members, eq(clients.ownerMemberId, members.id))
    .where(
      and(
        isNull(clients.deletedAt),
        clientScope(session),
        term
          ? or(ilike(clients.company, `%${term}%`), ilike(clients.contactName, `%${term}%`), ilike(clients.contactEmail, `%${term}%`))
          : undefined,
      ),
    )
    .orderBy(desc(clients.updatedAt))
    .limit(500);

  const ids = rows.map((row) => row.id);
  const assignments = ids.length
    ? await db
        .select({ clientId: clientAssignments.clientId, name: members.name, memberId: members.id })
        .from(clientAssignments)
        .innerJoin(members, eq(clientAssignments.memberId, members.id))
        .where(
          and(
            inArray(clientAssignments.clientId, ids),
            isNull(clientAssignments.removedAt),
            isNull(clientAssignments.deletedAt),
          ),
        )
    : [];
  const byClient = new Map<string, Array<{ id: string; name: string }>>();
  for (const assignment of assignments) {
    const list = byClient.get(assignment.clientId) ?? [];
    list.push({ id: assignment.memberId, name: assignment.name });
    byClient.set(assignment.clientId, list);
  }

  await logRead(session, null, { mode: "list", count: rows.length, search: term || null });
  return rows.map((row) => ({ ...row, assigned: byClient.get(row.id) ?? [] }));
}

export async function getClientDetail(session: AuthSession, clientId: string) {
  const client = await requireClientRead(session, clientId);
  const [owner] = await db.select({ name: members.name }).from(members).where(eq(members.id, client.ownerMemberId)).limit(1);

  const assignments = await db
    .select({
      id: clientAssignments.id,
      memberId: members.id,
      name: members.name,
      roleTitle: members.roleTitle,
      accessLevel: members.accessLevel,
      assignedAt: clientAssignments.assignedAt,
      assignedByName: sql<string>`(select name from members where id = ${clientAssignments.assignedBy})`,
    })
    .from(clientAssignments)
    .innerJoin(members, eq(clientAssignments.memberId, members.id))
    .where(
      and(
        eq(clientAssignments.clientId, clientId),
        isNull(clientAssignments.removedAt),
        isNull(clientAssignments.deletedAt),
      ),
    )
    .orderBy(desc(clientAssignments.assignedAt));

  const relatedMeetings = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      heldOn: meetings.heldOn,
      attendeeMemberIds: meetings.attendeeMemberIds,
      externalAttendees: meetings.externalAttendees,
      notes: meetings.notes,
    })
    .from(meetings)
    .where(and(eq(meetings.clientId, clientId), isNull(meetings.deletedAt)))
    .orderBy(desc(meetings.heldOn))
    .limit(50);

  await logRead(session, clientId, { mode: "detail" });
  return { ...client, ownerName: owner?.name ?? null, assignments, meetings: relatedMeetings };
}

async function assertClientOwner(ownerMemberId: string) {
  const [owner] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.id, ownerMemberId),
        eq(members.accessLevel, "owner"),
        eq(members.status, "active"),
        isNull(members.deletedAt),
      ),
    )
    .limit(1);
  if (!owner) throw badRequest("Choose an active owner.");
}

export async function createClient(session: AuthSession, input: CreateInput) {
  await assertClientOwner(input.ownerMemberId);
  const now = new Date();
  return db.transaction(async (tx) => {
    const [client] = await tx
      .insert(clients)
      .values({
        company: input.company,
        ownerMemberId: input.ownerMemberId,
        serviceType: input.serviceType,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        scopeOfWork: input.scopeOfWork,
        agreementStatus: input.agreementStatus,
        agreementRef: input.agreementRef,
        agreementSignedOn: input.agreementSignedOn,
        status: input.status,
        notes: input.notes,
        createdBy: session.member.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.clientCreate,
      entityType: "client",
      entityId: client.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { company: client.company, agreementStatus: client.agreementStatus, status: client.status },
    });
    return client;
  });
}

const editableFields = [
  "company",
  "ownerMemberId",
  "serviceType",
  "contactName",
  "contactEmail",
  "contactPhone",
  "scopeOfWork",
  "agreementStatus",
  "agreementRef",
  "agreementSignedOn",
  "status",
  "notes",
] as const;

export async function updateClient(session: AuthSession, clientId: string, input: UpdateInput) {
  if (input.ownerMemberId) await assertClientOwner(input.ownerMemberId);
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(clients).where(and(eq(clients.id, clientId), isNull(clients.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        before[field] = current[field];
        after[field] = input[field] ?? null;
      }
    }
    if (!Object.keys(after).length) return current;
    const [updated] = await tx
      .update(clients)
      .set({ ...after, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.clientUpdate,
      entityType: "client",
      entityId: clientId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { before, after },
    });
    return updated;
  });
}

export async function assignMember(session: AuthSession, clientId: string, input: AssignmentInput) {
  await requireClientRead(session, clientId);
  const [member] = await db
    .select({ id: members.id, accessLevel: members.accessLevel })
    .from(members)
    .where(
      and(
        eq(members.id, input.memberId),
        eq(members.status, "active"),
        isNull(members.deletedAt),
      ),
    )
    .limit(1);
  if (!member) throw badRequest("Choose an active member.");
  if (member.accessLevel === "owner") throw badRequest("Owners already have access to every client.");
  if (member.accessLevel === "viewer") throw badRequest("Viewers do not need client assignments.");

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: clientAssignments.id })
      .from(clientAssignments)
      .where(
        and(
          eq(clientAssignments.clientId, clientId),
          eq(clientAssignments.memberId, input.memberId),
          isNull(clientAssignments.removedAt),
          isNull(clientAssignments.deletedAt),
        ),
      )
      .limit(1);
    if (existing) throw conflict("That member is already assigned to this client.");
    const [assignment] = await tx
      .insert(clientAssignments)
      .values({
        clientId,
        memberId: input.memberId,
        assignedBy: session.member.id,
        createdBy: session.member.id,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.clientAssign,
      entityType: "client",
      entityId: clientId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { assignedMemberId: input.memberId, note: input.note ?? null },
    });
    return assignment;
  });
}

export async function unassignMember(session: AuthSession, clientId: string, assignmentId: string) {
  await requireClientRead(session, clientId);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(clientAssignments)
      .where(
        and(
          eq(clientAssignments.id, assignmentId),
          eq(clientAssignments.clientId, clientId),
          isNull(clientAssignments.removedAt),
          isNull(clientAssignments.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!current) throw notFound();
    await tx.update(clientAssignments).set({ removedAt: new Date(), updatedAt: new Date() }).where(eq(clientAssignments.id, assignmentId));
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.clientUnassign,
      entityType: "client",
      entityId: clientId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { removedMemberId: current.memberId, assignmentId },
    });
    return { ok: true };
  });
}
