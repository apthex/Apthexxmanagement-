import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clients, financeEntries, members } from "@/lib/db/schema";
import type { AuthSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS, writeAudit, writeAuditStandalone } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/http";
import { monthRange } from "@/lib/dates";
import { alertExport, alertFinanceChange } from "@/lib/alerts";
import { toCsv } from "@/lib/csv";
import type { financeCreateSchema, financeReverseSchema, financeUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof financeCreateSchema>;
type UpdateInput = z.infer<typeof financeUpdateSchema>;
type ReverseInput = z.infer<typeof financeReverseSchema>;

export const CATEGORY_LABELS = {
  services: "Services",
  tools: "Tools",
  payroll: "Payroll",
  infrastructure: "Infrastructure",
  travel: "Travel",
  other: "Other",
} as const;

function monthBounds(month?: string) {
  const safe = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : `${new Date().toISOString().slice(0, 7)}`;
  return monthRange(`${safe}-01`);
}

export async function listFinance(
  session: AuthSession,
  filters: { month?: string; q?: string; direction?: "in" | "out"; category?: string },
) {
  const bounds = monthBounds(filters.month);
  const baseWhere = and(
    isNull(financeEntries.deletedAt),
    sql`${financeEntries.entryDate} >= ${bounds.start}`,
    sql`${financeEntries.entryDate} <= ${bounds.end}`,
  );

  const all = await db
    .select({ direction: financeEntries.direction, amountPaise: financeEntries.amountPaise })
    .from(financeEntries)
    .where(baseWhere);

  const inPaise = all.filter((entry) => entry.direction === "in").reduce((sum, entry) => sum + Number(entry.amountPaise), 0);
  const outPaise = all.filter((entry) => entry.direction === "out").reduce((sum, entry) => sum + Number(entry.amountPaise), 0);

  const term = filters.q?.trim() ?? "";
  const rows = await db
    .select({
      id: financeEntries.id,
      entryDate: financeEntries.entryDate,
      direction: financeEntries.direction,
      amountPaise: financeEntries.amountPaise,
      description: financeEntries.description,
      category: financeEntries.category,
      clientId: financeEntries.clientId,
      clientName: clients.company,
      reversesEntryId: financeEntries.reversesEntryId,
      createdByName: members.name,
      createdAt: financeEntries.createdAt,
      updatedAt: financeEntries.updatedAt,
    })
    .from(financeEntries)
    .leftJoin(clients, eq(financeEntries.clientId, clients.id))
    .leftJoin(members, eq(financeEntries.createdBy, members.id))
    .where(
      and(
        baseWhere,
        filters.direction ? eq(financeEntries.direction, filters.direction) : undefined,
        filters.category ? eq(financeEntries.category, filters.category as keyof typeof CATEGORY_LABELS) : undefined,
        term
          ? or(ilike(financeEntries.description, `%${term}%`), ilike(clients.company, `%${term}%`))
          : undefined,
      ),
    )
    .orderBy(desc(financeEntries.entryDate), desc(financeEntries.createdAt))
    .limit(1000);

  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.financeRead,
    entityType: "finance",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { month: bounds.label, count: rows.length },
  });

  return {
    month: bounds.start.slice(0, 7),
    monthLabel: bounds.label,
    totals: { inPaise, outPaise, netPaise: inPaise - outPaise },
    entries: rows,
    count: rows.length,
  };
}

export async function createFinanceEntry(session: AuthSession, input: CreateInput) {
  if (input.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.deletedAt))).limit(1);
    if (!client) throw badRequest("Choose a valid client.");
  }
  const entry = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(financeEntries)
      .values({
        entryDate: input.entryDate,
        direction: input.direction,
        amountPaise: input.amountPaise,
        description: input.description,
        category: input.category,
        clientId: input.clientId,
        createdBy: session.member.id,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.financeCreate,
      entityType: "finance_entry",
      entityId: created.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: { after: created },
    });
    return created;
  });
  void alertFinanceChange(
    session.member.name,
    `${input.direction === "in" ? "Income" : "Expense"} created: ${input.description}`,
    `Amount: ₹${(input.amountPaise / 100).toLocaleString("en-IN")}\nCategory: ${CATEGORY_LABELS[input.category]}\nDate: ${input.entryDate}\nEntry: ${entry.id}`,
  );
  return entry;
}

export async function updateFinanceEntry(session: AuthSession, entryId: string, input: UpdateInput) {
  const entry = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(financeEntries)
      .where(and(eq(financeEntries.id, entryId), isNull(financeEntries.deletedAt)))
      .for("update")
      .limit(1);
    if (!current) throw notFound();
    if (current.reversesEntryId) throw conflict("Reversing entries cannot be edited. Create another correction instead.");
    const [reversed] = await tx
      .select({ id: financeEntries.id })
      .from(financeEntries)
      .where(and(eq(financeEntries.reversesEntryId, entryId), isNull(financeEntries.deletedAt)))
      .limit(1);
    if (reversed) throw conflict("This entry has already been reversed. Create a new entry instead.");

    const before = {
      entryDate: current.entryDate,
      amountPaise: current.amountPaise,
      description: current.description,
      category: current.category,
      clientId: current.clientId,
    };
    const [updated] = await tx
      .update(financeEntries)
      .set({
        ...(input.entryDate !== undefined ? { entryDate: input.entryDate } : {}),
        ...(input.amountPaise !== undefined ? { amountPaise: input.amountPaise } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(financeEntries.id, entryId))
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.financeUpdate,
      entityType: "finance_entry",
      entityId: entryId,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: {
        before,
        after: {
          entryDate: updated.entryDate,
          amountPaise: updated.amountPaise,
          description: updated.description,
          category: updated.category,
          clientId: updated.clientId,
        },
      },
    });
    return updated;
  });
  void alertFinanceChange(
    session.member.name,
    `Finance entry edited: ${entry.description}`,
    `Amount: ₹${(Number(entry.amountPaise) / 100).toLocaleString("en-IN")}\nEntry: ${entry.id}`,
  );
  return entry;
}

export async function reverseFinanceEntry(session: AuthSession, entryId: string, input: ReverseInput) {
  const reversal = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(financeEntries)
      .where(and(eq(financeEntries.id, entryId), isNull(financeEntries.deletedAt)))
      .for("update")
      .limit(1);
    if (!current) throw notFound();
    if (current.description !== input.confirmName) {
      throw conflict("Type the entry description exactly to confirm the reversal.");
    }
    if (current.reversesEntryId) throw conflict("A reversing entry cannot itself be reversed.");
    const [existing] = await tx
      .select({ id: financeEntries.id })
      .from(financeEntries)
      .where(and(eq(financeEntries.reversesEntryId, entryId), isNull(financeEntries.deletedAt)))
      .limit(1);
    if (existing) throw conflict("This entry has already been reversed.");

    const [created] = await tx
      .insert(financeEntries)
      .values({
        entryDate: new Date().toISOString().slice(0, 10),
        direction: current.direction === "in" ? "out" : "in",
        amountPaise: current.amountPaise,
        description: `Reversal — ${current.description}`,
        category: current.category,
        clientId: current.clientId,
        reversesEntryId: current.id,
        createdBy: session.member.id,
      })
      .returning();
    await writeAudit(tx, {
      memberId: session.member.id,
      action: AUDIT_ACTIONS.financeReverse,
      entityType: "finance_entry",
      entityId: current.id,
      outcome: "allowed",
      ip: session.ip,
      userAgent: session.userAgent,
      detail: {
        reversalId: created.id,
        reason: input.reason,
        before: current,
        after: created,
      },
    });
    return created;
  });
  void alertFinanceChange(
    session.member.name,
    `Finance entry reversed: ${reversal.description}`,
    `Amount: ₹${(Number(reversal.amountPaise) / 100).toLocaleString("en-IN")}\nReversal: ${reversal.id}\nReason: ${input.reason}`,
  );
  return reversal;
}

export async function exportFinanceCsv(session: AuthSession, month?: string) {
  const bounds = monthBounds(month);
  const rows = await db
    .select({
      entryDate: financeEntries.entryDate,
      direction: financeEntries.direction,
      amountPaise: financeEntries.amountPaise,
      description: financeEntries.description,
      category: financeEntries.category,
      clientName: clients.company,
      reversesEntryId: financeEntries.reversesEntryId,
    })
    .from(financeEntries)
    .leftJoin(clients, eq(financeEntries.clientId, clients.id))
    .where(and(isNull(financeEntries.deletedAt), sql`${financeEntries.entryDate} >= ${bounds.start}`, sql`${financeEntries.entryDate} <= ${bounds.end}`))
    .orderBy(financeEntries.entryDate, financeEntries.createdAt);

  const content = toCsv(
    ["date", "direction", "amount_paise", "description", "category", "client", "reverses_entry_id"],
    rows.map((row) => [
      row.entryDate,
      row.direction === "in" ? "income" : "expense",
      Number(row.amountPaise),
      row.description,
      row.category,
      row.clientName,
      row.reversesEntryId,
    ]),
  );

  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.export,
    entityType: "finance",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { month: bounds.label, rows: rows.length, format: "csv" },
  });
  void alertExport(session.member.name, `finance ${bounds.label}`, rows.length, session.ip);
  return { content, filename: `apthex-finance-${bounds.start.slice(0, 7)}.csv`, rowCount: rows.length };
}
