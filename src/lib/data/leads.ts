import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, leadEvents, leads, members } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import { conflict, notFound } from "@/lib/http";
import type { z } from "zod";
import type { leadConvertSchema, leadCreateSchema, leadStageSchema, leadUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof leadCreateSchema>;
type UpdateInput = z.infer<typeof leadUpdateSchema>;
type StageInput = z.infer<typeof leadStageSchema>;
type ConvertInput = z.infer<typeof leadConvertSchema>;

async function logRead(session: AuthSession, entityId: string | null, detail: Record<string, unknown> = {}) {
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.leadRead,
    entityType: "lead",
    entityId,
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail,
  });
}

const ownerSelect = { id: members.id, name: members.name };

export async function listLeads(session: AuthSession, search = "") {
  const term = search.trim();
  const rows = await db
    .select({
      id: leads.id,
      company: leads.company,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
      contactPhone: leads.contactPhone,
      source: leads.source,
      stage: leads.stage,
      ownerMemberId: leads.ownerMemberId,
      ownerName: members.name,
      valueEstimatePaise: leads.valueEstimatePaise,
      nextAction: leads.nextAction,
      nextActionOn: leads.nextActionOn,
      notes: leads.notes,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .innerJoin(members, eq(leads.ownerMemberId, members.id))
    .where(
      and(
        isNull(leads.deletedAt),
        term
          ? or(
              ilike(leads.company, `%${term}%`),
              ilike(leads.contactName, `%${term}%`),
              ilike(leads.contactEmail, `%${term}%`),
              ilike(leads.nextAction, `%${term}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(leads.updatedAt))
    .limit(500);

  await logRead(session, null, { mode: "list", count: rows.length, search: term || null });
  return rows;
}

export async function getLead(session: AuthSession, leadId: string) {
  const [lead] = await db
    .select({
      id: leads.id,
      company: leads.company,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
      contactPhone: leads.contactPhone,
      source: leads.source,
      stage: leads.stage,
      ownerMemberId: leads.ownerMemberId,
      valueEstimatePaise: leads.valueEstimatePaise,
      nextAction: leads.nextAction,
      nextActionOn: leads.nextActionOn,
      notes: leads.notes,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1);
  if (!lead) throw notFound();

  const events = await db
    .select({
      id: leadEvents.id,
      fromStage: leadEvents.fromStage,
      toStage: leadEvents.toStage,
      note: leadEvents.note,
      occurredAt: leadEvents.occurredAt,
      memberName: members.name,
    })
    .from(leadEvents)
    .leftJoin(members, eq(leadEvents.memberId, members.id))
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(desc(leadEvents.occurredAt))
    .limit(100);

  const [converted] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.leadId, leadId), isNull(clients.deletedAt)))
    .limit(1);

  await logRead(session, leadId, { mode: "detail" });
  return { ...lead, events, convertedClientId: converted?.id ?? null };
}

async function assertActiveOwner(ownerMemberId: string) {
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
  if (!owner) throw conflict("Choose an active owner for this record.");
}

export async function createLead(session: AuthSession, input: CreateInput) {
  await assertActiveOwner(input.ownerMemberId);
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [lead] = await tx
      .insert(leads)
      .values({
        company: input.company,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        source: input.source,
        stage: "identified",
        ownerMemberId: input.ownerMemberId,
        valueEstimatePaise: input.valueEstimatePaise,
        nextAction: input.nextAction,
        nextActionOn: input.nextActionOn,
        notes: input.notes,
        createdBy: session.member.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await tx.insert(leadEvents).values({
      leadId: lead.id,
      memberId: session.member.id,
      fromStage: null,
      toStage: "identified",
      note: "Lead created.",
    });
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.leadCreate,
      entityType: "lead",
      entityId: lead.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { after: { company: lead.company, stage: lead.stage, ownerMemberId: lead.ownerMemberId } },
    });
    return lead;
  });
  return result;
}

const editableFields = [
  "company",
  "contactName",
  "contactEmail",
  "contactPhone",
  "source",
  "ownerMemberId",
  "valueEstimatePaise",
  "nextAction",
  "nextActionOn",
  "notes",
] as const;

export async function updateLead(session: AuthSession, leadId: string, input: UpdateInput) {
  if (input.ownerMemberId) await assertActiveOwner(input.ownerMemberId);
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(leads).where(and(eq(leads.id, leadId), isNull(leads.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        before[field] = current[field];
        after[field] = input[field] ?? null;
      }
    }
    if (Object.keys(after).length === 0) return current;

    const [updated] = await tx
      .update(leads)
      .set({ ...after, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.leadUpdate,
      entityType: "lead",
      entityId: leadId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { before, after },
    });
    return updated;
  });
}

export async function moveLeadStage(session: AuthSession, leadId: string, input: StageInput) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(leads).where(and(eq(leads.id, leadId), isNull(leads.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();
    if (current.stage === input.stage) return { lead: current, changed: false };

    const now = new Date();
    const [updated] = await tx
      .update(leads)
      .set({ stage: input.stage, updatedAt: now })
      .where(eq(leads.id, leadId))
      .returning();
    await tx.insert(leadEvents).values({
      leadId,
      memberId: session.member.id,
      fromStage: current.stage,
      toStage: input.stage,
      note: input.note ?? `Stage moved from ${current.stage} to ${input.stage}.`,
      occurredAt: now,
    });
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.leadStage,
      entityType: "lead",
      entityId: leadId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { from: current.stage, to: input.stage, note: input.note ?? null },
    });
    return { lead: updated, changed: true };
  });
}

export async function convertLead(session: AuthSession, leadId: string, input: ConvertInput) {
  await assertActiveOwner(input.ownerMemberId);
  return db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(and(eq(leads.id, leadId), isNull(leads.deletedAt))).for("update").limit(1);
    if (!lead) throw notFound();
    if (lead.stage !== "won") throw conflict("Only a Won lead can be converted to a client.");

    const [existing] = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.leadId, leadId), isNull(clients.deletedAt)))
      .limit(1);
    if (existing) throw conflict("This lead has already been converted to a client.");

    const now = new Date();
    const [client] = await tx
      .insert(clients)
      .values({
        leadId,
        company: lead.company,
        ownerMemberId: input.ownerMemberId,
        serviceType: input.serviceType,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        contactPhone: lead.contactPhone,
        scopeOfWork: input.scopeOfWork,
        agreementStatus: input.agreementStatus,
        agreementRef: input.agreementRef,
        agreementSignedOn: input.agreementSignedOn,
        status: "active",
        notes: input.notes,
        createdBy: session.member.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(leadEvents).values({
      leadId,
      memberId: session.member.id,
      fromStage: "won",
      toStage: "won",
      note: `Converted to client${input.agreementStatus === "none" ? " without an agreement." : "."}`,
      occurredAt: now,
    });
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.leadConvert,
      entityType: "lead",
      entityId: leadId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { clientId: client.id, agreementStatus: input.agreementStatus },
    });
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.clientCreate,
      entityType: "client",
      entityId: client.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { fromLeadId: leadId, company: client.company },
    });
    return client;
  });
}

export async function deleteLead(session: AuthSession, leadId: string, confirmName: string) {
  return db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(and(eq(leads.id, leadId), isNull(leads.deletedAt))).for("update").limit(1);
    if (!lead) throw notFound();
    if (lead.company !== confirmName) throw conflict("Type the company name exactly to confirm deletion.");
    await tx.update(leads).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId));
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.leadDelete,
      entityType: "lead",
      entityId: leadId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { company: lead.company },
    });
    return { ok: true };
  });
}
