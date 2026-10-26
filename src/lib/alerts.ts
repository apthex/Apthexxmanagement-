import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, members } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";

export function istHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
}

export function istDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export async function ownerEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: members.email })
    .from(members)
    .where(and(eq(members.accessLevel, "owner"), eq(members.status, "active"), sql`${members.deletedAt} is null`));
  return rows.map((row) => row.email);
}

/** Alerts are best-effort and must never be allowed to fail a business action. */
export async function alertOwners(subject: string, text: string): Promise<void> {
  try {
    const recipients = await ownerEmails();
    if (recipients.length === 0) {
      console.warn("[alerts] no active owner email addresses");
      return;
    }
    await sendEmail({ to: recipients, subject, text });
  } catch (error) {
    console.error("[alerts] failed", error instanceof Error ? error.message : error);
  }
}

export async function alertFailedLogins(email: string, attempts: number, ip: string, userAgent: string): Promise<void> {
  await alertOwners(
    `Security alert: ${attempts} failed sign-in attempts`,
    `Account: ${email}\nAttempts: ${attempts} within 15 minutes\nIP: ${ip}\nDevice: ${userAgent}\nTime: ${istDateLabel()}\n\nAt five attempts the account locks for 30 minutes. If this continues, investigate the source.`,
  );
}

export async function alertLocked(email: string, ip: string): Promise<void> {
  await alertOwners(
    "Security alert: account locked",
    `Account: ${email}\nReason: five failed sign-in attempts within 15 minutes\nIP: ${ip}\nTime: ${istDateLabel()}\n\nLocked for 30 minutes.`,
  );
}

export async function alertNewDevice(
  memberName: string,
  email: string,
  ip: string,
  userAgent: string,
): Promise<void> {
  await alertOwners(
    "Security alert: sign-in from a new device or IP",
    `Member: ${memberName} (${email})\nIP: ${ip}\nDevice: ${userAgent}\nTime: ${istDateLabel()}\n\nIf this was not them, deactivate the account and reset its password immediately.`,
  );
}

export async function alertOutsideHours(memberName: string, email: string, ip: string): Promise<void> {
  await alertOwners(
    "Security alert: sign-in outside working hours",
    `Member: ${memberName} (${email})\nIP: ${ip}\nTime: ${istDateLabel()} IST\nOutside the expected 07:00–23:00 IST window.`,
  );
}

export async function alertPrivilegeChange(actor: string, subject: string): Promise<void> {
  await alertOwners("Security alert: access changed", `${actor}\n${subject}\nTime: ${istDateLabel()}`);
}

export async function alertFinanceChange(actor: string, subject: string, detail: string): Promise<void> {
  await alertOwners("Finance entry changed", `${actor}\n${subject}\n${detail}\nTime: ${istDateLabel()}`);
}

export async function alertExport(actor: string, what: string, rowCount: number, ip: string): Promise<void> {
  await alertOwners(
    "Security alert: CSV export",
    `Member: ${actor}\nExport: ${what}\nRows: ${rowCount}\nIP: ${ip}\nTime: ${istDateLabel()}`,
  );
}

export async function maybeAlertDeniedProbe(memberId: string): Promise<void> {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const [row] = await db
      .select({ total: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.memberId, memberId),
          eq(auditEvents.outcome, "denied"),
          gte(auditEvents.occurredAt, since),
        ),
      );
    if (Number(row?.total ?? 0) === 3) {
      const [member] = await db
        .select({ name: members.name, email: members.email })
        .from(members)
        .where(eq(members.id, memberId))
        .limit(1);
      await alertOwners(
        "Security alert: repeated permission denials",
        `Member: ${member?.name ?? memberId} (${member?.email ?? "unknown"})\nThree or more denied attempts in the last 10 minutes. This can indicate probing.`,
      );
    }
  } catch (error) {
    console.error("[alerts] denied probe check failed", error instanceof Error ? error.message : error);
  }
}

export async function sendDailyDigest(): Promise<{ sent: boolean; summary: string }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [logins] = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(and(eq(auditEvents.action, "auth.login"), gte(auditEvents.occurredAt, since)));
  const [failed] = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(and(eq(auditEvents.action, "auth.fail"), gte(auditEvents.occurredAt, since)));
  const [denied] = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(and(eq(auditEvents.outcome, "denied"), gte(auditEvents.occurredAt, since)));
  const [logs] = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(and(eq(auditEvents.action, "worklog.create"), gte(auditEvents.occurredAt, since)));
  const [closed] = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(and(eq(auditEvents.action, "task.update"), gte(auditEvents.occurredAt, since)));

  const summary = [
    `Sign-ins: ${logins?.n ?? 0}`,
    `Failed sign-ins: ${failed?.n ?? 0}`,
    `Denied attempts: ${denied?.n ?? 0}`,
    `Work logs filed: ${logs?.n ?? 0}`,
    `Task updates: ${closed?.n ?? 0}`,
  ].join("\n");

  await alertOwners(
    `Apthex Internal daily digest — ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(new Date())}`,
    `${summary}\n\nUnusual activity: review the Audit log for denied attempts and role changes.\n\nThis digest is sent at 21:00 IST.`,
  );
  return { sent: true, summary };
}
