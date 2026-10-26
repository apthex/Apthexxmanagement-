import { and, count, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, financeEntries, leads, meetings, members, tasks, workLogs } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { meetingScope } from "@/lib/data/meetings";
import { addDays, istToday, monthRange, weekRange } from "@/lib/dates";
import { AUDIT_ACTIONS, writeAuditStandalone } from "@/lib/audit";

export async function getDashboard(session: AuthSession) {
  const owner = session.member.accessLevel === "owner";
  const today = istToday();
  const week = weekRange(today);
  const month = monthRange(today);

  const myTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueOn: tasks.dueOn,
      status: tasks.status,
      clientName: clients.company,
    })
    .from(tasks)
    .leftJoin(clients, eq(tasks.clientId, clients.id))
    .where(
      and(
        eq(tasks.assigneeMemberId, session.member.id),
        isNull(tasks.deletedAt),
        inArray(tasks.status, ["todo", "in_progress", "blocked"]),
      ),
    )
    .orderBy(sql`${tasks.dueOn} asc nulls last`)
    .limit(10);

  const dueToday = myTasks.filter((task) => task.dueOn === today);
  const meetingsThisWeek = await db
    .select({ id: meetings.id, title: meetings.title, heldOn: meetings.heldOn })
    .from(meetings)
    .where(
      and(
        isNull(meetings.deletedAt),
        gte(meetings.heldOn, week.start),
        lte(meetings.heldOn, week.end),
        meetingScope(session),
      ),
    )
    .orderBy(meetings.heldOn)
    .limit(20);

  const [todayLog] = await db
    .select({ id: workLogs.id })
    .from(workLogs)
    .where(
      and(
        eq(workLogs.memberId, session.member.id),
        eq(workLogs.logDate, today),
        isNull(workLogs.deletedAt),
      ),
    )
    .limit(1);

  let ownerData:
    | {
        leadsInPlay: number;
        leadsByStage: Record<string, number>;
        activeClients: number;
        finance: { inPaise: number; outPaise: number; netPaise: number; monthLabel: string };
        teamCount: number;
      }
    | undefined;

  if (owner) {
    const stageRows = await db
      .select({ stage: leads.stage, n: count() })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .groupBy(leads.stage);
    const leadsByStage = Object.fromEntries(stageRows.map((row) => [row.stage, Number(row.n)]));
    const leadsInPlay = ["identified", "talking", "pitched"].reduce((sum, stage) => sum + (leadsByStage[stage] ?? 0), 0);

    const [clientCount] = await db
      .select({ n: count() })
      .from(clients)
      .where(and(isNull(clients.deletedAt), eq(clients.status, "active")));
    const [teamCount] = await db
      .select({ n: count() })
      .from(members)
      .where(and(isNull(members.deletedAt), eq(members.status, "active")));
    const financeRows = await db
      .select({ direction: financeEntries.direction, amountPaise: financeEntries.amountPaise })
      .from(financeEntries)
      .where(
        and(
          isNull(financeEntries.deletedAt),
          gte(financeEntries.entryDate, month.start),
          lte(financeEntries.entryDate, month.end),
        ),
      );
    const inPaise = financeRows.filter((row) => row.direction === "in").reduce((sum, row) => sum + Number(row.amountPaise), 0);
    const outPaise = financeRows.filter((row) => row.direction === "out").reduce((sum, row) => sum + Number(row.amountPaise), 0);

    ownerData = {
      leadsInPlay,
      leadsByStage,
      activeClients: Number(clientCount?.n ?? 0),
      finance: { inPaise, outPaise, netPaise: inPaise - outPaise, monthLabel: month.label },
      teamCount: Number(teamCount?.n ?? 0),
    };
  }

  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.pageView,
    entityType: "dashboard",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { path: "/dashboard", source: "api" },
  });

  return {
    today,
    weekStart: week.start,
    weekEnd: week.end,
    nextWeekStart: addDays(week.start, 7),
    isOwner: owner,
    myTasks,
    openTaskCount: myTasks.length,
    dueToday,
    meetingsThisWeek,
    loggedToday: Boolean(todayLog),
    ...(ownerData ? { owner: ownerData } : {}),
  };
}
