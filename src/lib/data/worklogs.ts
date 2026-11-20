import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { members, tasks, workLogs } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { auditObjectDenial } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/http";
import { daysBetweenInclusive, istToday, weekRange } from "@/lib/dates";
import type { workLogCreateSchema, workLogRateSchema, workLogUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof workLogCreateSchema>;
type UpdateInput = z.infer<typeof workLogUpdateSchema>;
type RateInput = z.infer<typeof workLogRateSchema>;

function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

async function validateTaskIds(session: AuthSession, taskIds: string[]) {
  const unique = [...new Set(taskIds)];
  if (!unique.length) return unique;
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        inArray(tasks.id, unique),
        eq(tasks.assigneeMemberId, session.member.id),
        isNull(tasks.deletedAt),
      ),
    );
  if (rows.length !== unique.length) throw badRequest("One or more linked tasks are not yours.");
  return unique;
}

/**
 * Weekly roll-up. Owners see every active non-viewer; everyone else sees only
 * themselves. Ratings are stripped for non-owners at the query/response layer.
 */
export async function listWorkLogs(session: AuthSession, anchorDate?: string) {
  const today = istToday();
  const week = weekRange(anchorDate ?? today);
  const isOwner = session.member.accessLevel === "owner";

  const people = await db
    .select({ id: members.id, name: members.name, roleTitle: members.roleTitle, accessLevel: members.accessLevel })
    .from(members)
    .where(
      and(
        eq(members.status, "active"),
        isNull(members.deletedAt),
        isOwner ? inArray(members.accessLevel, ["owner", "team", "growth"]) : eq(members.id, session.member.id),
      ),
    )
    .orderBy(members.name);

  const logs = await db
    .select()
    .from(workLogs)
    .where(
      and(
        isNull(workLogs.deletedAt),
        inArray(workLogs.memberId, people.map((person) => person.id)),
        inArray(workLogs.logDate, daysBetweenInclusive(week.start, week.end)),
      ),
    );

  const visibleDays = daysBetweenInclusive(week.start, week.end).filter(
    (date) => date <= today && date >= week.start,
  );

  const result = people.map((person) => {
    const personLogs = logs
      .filter((log) => log.memberId === person.id)
      .sort((a, b) => b.logDate.localeCompare(a.logDate));
    const totalHours = personLogs.reduce((sum, log) => sum + Number(log.hours), 0);
    const ratings = personLogs.map((log) => log.rating).filter((rating): rating is number => rating !== null);
    const loggedDays = new Set(personLogs.map((log) => log.logDate));
    const missingDays = visibleDays.filter((date) => isWeekday(date) && !loggedDays.has(date));
    return {
      memberId: person.id,
      name: person.name,
      roleTitle: person.roleTitle,
      accessLevel: person.accessLevel,
      totalHours: Math.round(totalHours * 100) / 100,
      averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      missingDays,
      logs: personLogs.map((log) => ({
        id: log.id,
        logDate: log.logDate,
        summary: log.summary,
        hours: String(log.hours),
        taskIds: log.taskIds,
        locked: log.logDate !== today,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        ...(isOwner ? { rating: log.rating, ratedBy: log.ratedBy } : {}),
      })),
    };
  });

  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.worklogRead,
    entityType: "work_log",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { weekStart: week.start, weekEnd: week.end, mode: isOwner ? "all" : "own" },
  });

  return {
    weekStart: week.start,
    weekEnd: week.end,
    today,
    canRate: isOwner,
    members: result,
  };
}

export async function createWorkLog(session: AuthSession, input: CreateInput) {
  const today = istToday();
  if (input.logDate !== today) {
    throw conflict("Work logs can only be filed for today. Past days are locked.");
  }
  const taskIds = await validateTaskIds(session, input.taskIds);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: workLogs.id })
      .from(workLogs)
      .where(and(eq(workLogs.memberId, session.member.id), eq(workLogs.logDate, input.logDate), isNull(workLogs.deletedAt)))
      .limit(1);
    if (existing) throw conflict("You already filed a work log for today. Edit that entry instead.");

    const [log] = await tx
      .insert(workLogs)
      .values({
        memberId: session.member.id,
        logDate: input.logDate,
        summary: input.summary,
        hours: input.hours,
        taskIds,
        createdBy: session.member.id,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.worklogCreate,
      entityType: "work_log",
      entityId: log.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { logDate: log.logDate, hours: log.hours, taskCount: taskIds.length },
    });
    return log;
  });
}

async function getOwnLogForEdit(session: AuthSession, logId: string) {
  const [log] = await db
    .select()
    .from(workLogs)
    .where(and(eq(workLogs.id, logId), isNull(workLogs.deletedAt)))
    .limit(1);
  if (!log) throw notFound();
  if (log.memberId !== session.member.id) return auditObjectDenial(session, "work_log", logId, { module: "worklogs" });
  return log;
}

export async function updateWorkLog(session: AuthSession, logId: string, input: UpdateInput) {
  const log = await getOwnLogForEdit(session, logId);
  if (log.logDate !== istToday()) {
    throw conflict("That work log is locked because its day has ended.");
  }
  const taskIds = input.taskIds ? await validateTaskIds(session, input.taskIds) : undefined;

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(workLogs).where(eq(workLogs.id, logId)).for("update").limit(1);
    if (!current) throw notFound();
    if (current.logDate !== istToday()) throw conflict("That work log is locked because its day has ended.");
    const before = { summary: current.summary, hours: current.hours, taskIds: current.taskIds };
    const [updated] = await tx
      .update(workLogs)
      .set({
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        ...(taskIds !== undefined ? { taskIds } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workLogs.id, logId))
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.worklogUpdate,
      entityType: "work_log",
      entityId: logId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: {
        before,
        after: { summary: updated.summary, hours: updated.hours, taskIds: updated.taskIds },
      },
    });
    return updated;
  });
}

export async function rateWorkLog(session: AuthSession, logId: string, input: RateInput) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(workLogs).where(and(eq(workLogs.id, logId), isNull(workLogs.deletedAt))).for("update").limit(1);
    if (!current) throw notFound();
    const [updated] = await tx
      .update(workLogs)
      .set({
        rating: input.rating,
        ratedBy: input.rating === null ? null : session.member.id,
        updatedAt: new Date(),
      })
      .where(eq(workLogs.id, logId))
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.worklogRate,
      entityType: "work_log",
      entityId: logId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { before: current.rating, after: input.rating, subjectMemberId: current.memberId },
    });
    return updated;
  });
}
