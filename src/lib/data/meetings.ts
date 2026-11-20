import { and, desc, eq, exists, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientAssignments, clients, meetings, members } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { auditObjectDenial } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/http";
import type { meetingCreateSchema, meetingUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof meetingCreateSchema>;
type UpdateInput = z.infer<typeof meetingUpdateSchema>;

export function meetingScope(session: AuthSession) {
  if (session.member.accessLevel === "owner" || session.member.accessLevel === "viewer") return undefined;
  return or(
    sql`${meetings.attendeeMemberIds} @> array[${session.member.id}::uuid]`,
    exists(
      db
        .select({ one: sql`1` })
        .from(clientAssignments)
        .where(
          and(
            eq(clientAssignments.clientId, meetings.clientId),
            eq(clientAssignments.memberId, session.member.id),
            isNull(clientAssignments.removedAt),
            isNull(clientAssignments.deletedAt),
          ),
        ),
    ),
  );
}

async function logRead(session: AuthSession, entityId: string | null, detail: Record<string, unknown>) {
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.meetingRead,
    entityType: "meeting",
    entityId,
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail,
  });
}

export async function listMeetings(session: AuthSession, search = "") {
  const term = search.trim();
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      heldOn: meetings.heldOn,
      clientId: meetings.clientId,
      clientName: clients.company,
      attendeeMemberIds: meetings.attendeeMemberIds,
      externalAttendees: meetings.externalAttendees,
      notes: meetings.notes,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .leftJoin(clients, eq(meetings.clientId, clients.id))
    .where(
      and(
        isNull(meetings.deletedAt),
        meetingScope(session),
        term ? or(ilike(meetings.title, `%${term}%`), ilike(meetings.notes, `%${term}%`), ilike(clients.company, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(desc(meetings.heldOn), desc(meetings.createdAt))
    .limit(500);

  const people = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(isNull(members.deletedAt));
  const names = new Map(people.map((person) => [person.id, person.name]));

  await logRead(session, null, { mode: "list", count: rows.length });
  return rows.map((row) => ({
    ...row,
    attendees: row.attendeeMemberIds.map((id) => ({ id, name: names.get(id) ?? "Inactive member" })),
  }));
}

async function validateInput(input: CreateInput | UpdateInput) {
  const attendeeIds = input.attendeeMemberIds ? [...new Set(input.attendeeMemberIds)] : undefined;
  if (attendeeIds?.length) {
    const found = await db
      .select({ id: members.id })
      .from(members)
      .where(and(inArray(members.id, attendeeIds), isNull(members.deletedAt)));
    if (found.length !== attendeeIds.length) throw badRequest("One or more attendees no longer exist.");
  }
  if (input.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.deletedAt))).limit(1);
    if (!client) throw badRequest("Choose a valid client.");
  }
  return attendeeIds;
}

export async function createMeeting(session: AuthSession, input: CreateInput) {
  const attendees = (await validateInput(input)) ?? [];
  return db.transaction(async (tx) => {
    const [meeting] = await tx
      .insert(meetings)
      .values({
        title: input.title,
        heldOn: input.heldOn,
        clientId: input.clientId,
        attendeeMemberIds: attendees,
        externalAttendees: input.externalAttendees,
        notes: input.notes,
        createdBy: session.member.id,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.meetingCreate,
      entityType: "meeting",
      entityId: meeting.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { title: meeting.title, heldOn: meeting.heldOn, clientId: meeting.clientId, attendeeCount: attendees.length },
    });
    return meeting;
  });
}

export async function updateMeeting(session: AuthSession, meetingId: string, input: UpdateInput) {
  const attendees = await validateInput(input);
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(meetings).where(and(eq(meetings.id, meetingId), isNull(meetings.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();
    if (session.member.accessLevel !== "owner") {
      return auditObjectDenial(session, "meeting", meetingId, { module: "meetings" });
    }
    const before = {
      title: current.title,
      heldOn: current.heldOn,
      clientId: current.clientId,
      attendeeMemberIds: current.attendeeMemberIds,
      externalAttendees: current.externalAttendees,
      notes: current.notes,
    };
    const [updated] = await tx
      .update(meetings)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.heldOn !== undefined ? { heldOn: input.heldOn } : {}),
        ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
        ...(attendees !== undefined ? { attendeeMemberIds: attendees } : {}),
        ...(input.externalAttendees !== undefined ? { externalAttendees: input.externalAttendees } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, meetingId))
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.meetingUpdate,
      entityType: "meeting",
      entityId: meetingId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: {
        before,
        after: {
          title: updated.title,
          heldOn: updated.heldOn,
          clientId: updated.clientId,
          attendeeMemberIds: updated.attendeeMemberIds,
          externalAttendees: updated.externalAttendees,
          notes: updated.notes,
        },
      },
    });
    return updated;
  });
}
