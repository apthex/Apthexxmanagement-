import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clients, members, taskComments, tasks } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { auditObjectDenial } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/http";
import { scopeToMember } from "@/lib/permissions";
import type { taskCommentSchema, taskCreateSchema, taskUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof taskCreateSchema>;
type UpdateInput = z.infer<typeof taskUpdateSchema>;
type CommentInput = z.infer<typeof taskCommentSchema>;

async function logRead(session: AuthSession, entityId: string | null, detail: Record<string, unknown>) {
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.taskRead,
    entityType: "task",
    entityId,
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail,
  });
}

export async function listTasks(
  session: AuthSession,
  filters: { q?: string; status?: string; assigneeMemberId?: string; due?: string },
) {
  const term = filters.q?.trim() ?? "";
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      assigneeMemberId: tasks.assigneeMemberId,
      assigneeName: members.name,
      clientId: tasks.clientId,
      clientName: clients.company,
      dueOn: tasks.dueOn,
      status: tasks.status,
      completedAt: tasks.completedAt,
      meetingId: tasks.meetingId,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(members, eq(tasks.assigneeMemberId, members.id))
    .leftJoin(clients, eq(tasks.clientId, clients.id))
    .where(
      and(
        isNull(tasks.deletedAt),
        scopeToMember(tasks.assigneeMemberId, session),
        filters.status ? eq(tasks.status, filters.status as "todo" | "in_progress" | "blocked" | "done") : undefined,
        session.member.accessLevel === "owner" && filters.assigneeMemberId
          ? eq(tasks.assigneeMemberId, filters.assigneeMemberId)
          : undefined,
        filters.due === "overdue"
          ? and(sql`${tasks.dueOn} < current_date at time zone 'Asia/Kolkata'`, sql`${tasks.status} <> 'done'`)
          : filters.due === "today"
            ? eq(tasks.dueOn, sql`(current_timestamp at time zone 'Asia/Kolkata')::date`)
            : undefined,
        term
          ? or(ilike(tasks.title, `%${term}%`), ilike(tasks.description, `%${term}%`), ilike(clients.company, `%${term}%`))
          : undefined,
      ),
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(500);

  await logRead(session, null, { mode: "list", count: rows.length });
  return rows;
}

async function getTaskForSession(session: AuthSession, taskId: string) {
  const [task] = await db
    .select({
      task: tasks,
      assigneeName: members.name,
      assigneeAccess: members.accessLevel,
      clientName: clients.company,
    })
    .from(tasks)
    .innerJoin(members, eq(tasks.assigneeMemberId, members.id))
    .leftJoin(clients, eq(tasks.clientId, clients.id))
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1);
  if (!task) throw notFound();
  if (session.member.accessLevel !== "owner" && task.task.assigneeMemberId !== session.member.id) {
    return auditObjectDenial(session, "task", taskId, { module: "tasks" });
  }
  return task;
}

export async function getTaskDetail(session: AuthSession, taskId: string) {
  const row = await getTaskForSession(session, taskId);
  const comments = await db
    .select({
      id: taskComments.id,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      memberId: taskComments.memberId,
      memberName: members.name,
    })
    .from(taskComments)
    .innerJoin(members, eq(taskComments.memberId, members.id))
    .where(and(eq(taskComments.taskId, taskId), isNull(taskComments.deletedAt)))
    .orderBy(taskComments.createdAt)
    .limit(200);
  await logRead(session, taskId, { mode: "detail" });
  return { ...row.task, assigneeName: row.assigneeName, clientName: row.clientName, comments };
}

async function assertActiveAssignee(memberId: string) {
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.status, "active"), isNull(members.deletedAt)))
    .limit(1);
  if (!member) throw badRequest("Choose an active assignee.");
}

export async function createTask(session: AuthSession, input: CreateInput) {
  await assertActiveAssignee(input.assigneeMemberId);
  if (input.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.deletedAt))).limit(1);
    if (!client) throw badRequest("Choose a valid client.");
  }
  const now = new Date();
  return db.transaction(async (tx) => {
    const [task] = await tx
      .insert(tasks)
      .values({
        title: input.title,
        description: input.description,
        assigneeMemberId: input.assigneeMemberId,
        clientId: input.clientId,
        dueOn: input.dueOn,
        status: input.status,
        meetingId: input.meetingId,
        completedAt: input.status === "done" ? now : null,
        createdBy: session.member.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.taskCreate,
      entityType: "task",
      entityId: task.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { title: task.title, assigneeMemberId: task.assigneeMemberId, clientId: task.clientId, status: task.status },
    });
    return task;
  });
}

export async function updateTask(session: AuthSession, taskId: string, input: UpdateInput) {
  await getTaskForSession(session, taskId);
  const keys = Object.keys(input);
  if (session.member.accessLevel !== "owner" && keys.some((key) => key !== "status")) {
    return auditObjectDenial(session, "task", taskId, { reason: "assignee attempted owner-only fields", keys });
  }
  if (input.assigneeMemberId) await assertActiveAssignee(input.assigneeMemberId);
  if (input.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.deletedAt))).limit(1);
    if (!client) throw badRequest("Choose a valid client.");
  }

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(tasks).where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of keys as (keyof UpdateInput)[]) {
      before[key] = current[key as keyof typeof current];
      after[key] = input[key] ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input, "status")) {
      after.completedAt = input.status === "done" ? current.completedAt ?? new Date() : null;
    }
    const [updated] = await tx
      .update(tasks)
      .set({ ...after, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.taskUpdate,
      entityType: "task",
      entityId: taskId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { before, after },
    });
    return updated;
  });
}

export async function addTaskComment(session: AuthSession, taskId: string, input: CommentInput) {
  await getTaskForSession(session, taskId);
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(taskComments)
      .values({
        taskId,
        memberId: session.member.id,
        body: input.body,
        createdBy: session.member.id,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.taskComment,
      entityType: "task",
      entityId: taskId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { commentId: comment.id },
    });
    return comment;
  });
}
