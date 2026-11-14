import cron from "node-cron";
import Complaint from "../models/Complaint.js";
import Institute from "../models/Institute.js";
import CaseEvent from "../models/CaseEvent.js";
import { env } from "../config/env.js";
import { previousMonthKey } from "../utils/dates.js";
import { buildMonthlyReportData } from "../services/monthlyReport.js";
import { queueMonthlyReport, queueEscalation, processOutbox } from "../services/email.js";
import { purgeDueComplaints } from "../services/purge.js";
import { applyStatsDelta } from "../services/stats.js";
import { audit } from "../utils/audit.js";

let started = false;

export async function runDeletionJob() {
  const count = await purgeDueComplaints({ limit: 500, deletedBy: "scheduler" });
  if (count) console.log(`[jobs] retention deletion removed ${count} case(s)`);
  return count;
}

export async function runMonthlyReportJob(now = new Date()) {
  const month = previousMonthKey(now);
  const institutes = await Institute.find({ status: "active", head_email: { $nin: [null, ""] } })
    .select("code name head_email")
    .lean();
  let queued = 0;
  for (const institute of institutes) {
    try {
      const data = await buildMonthlyReportData(institute.code, month);
      await queueMonthlyReport({
        institute: data.institute || institute,
        month,
        received: data.received,
        completed: data.completed,
        inProcess: data.inProcess,
      });
      queued += 1;
      await audit({
        action: "monthly_report_queued",
        entity: "institute",
        entity_id: institute.code,
        detail: `month=${month}; trigger=scheduler`,
      });
    } catch (error) {
      console.error(`[jobs] monthly report failed for ${institute.code}:`, error.message);
    }
  }
  const delivery = await processOutbox({ limit: 50 });
  console.log(`[jobs] monthly reports queued=${queued} month=${month} delivery=${JSON.stringify(delivery)}`);
  return { month, queued, delivery };
}

export async function runEscalationJob(now = new Date()) {
  const days = env.ESCALATION_DAYS;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const candidates = await Complaint.find({
    status: "in_process",
    flagged_spam: false,
    escalated: { $ne: true },
    created_at: { $lte: cutoff },
  })
    .select("_id ref_id institute_code created_at")
    .limit(500)
    .lean();

  let escalated = 0;
  for (const candidate of candidates) {
    const updated = await Complaint.findOneAndUpdate(
      { _id: candidate._id, escalated: { $ne: true }, status: "in_process" },
      { $set: { escalated: true } },
      { returnDocument: "after" }
    );
    if (!updated) continue;
    escalated += 1;
    await applyStatsDelta(updated.institute_code, { escalated: 1 });
    await CaseEvent.create({ complaint_id: updated._id, member_id: null, event: "escalated", note: `No action for ${days} days` });
    await queueEscalation({ complaint: updated, days });
    await audit({
      action: "case_escalated",
      entity: "complaint",
      entity_id: updated.ref_id,
      detail: `days=${days}; trigger=scheduler`,
    });
  }
  const delivery = await processOutbox({ limit: 50 });
  console.log(`[jobs] escalations=${escalated} days=${days} delivery=${JSON.stringify(delivery)}`);
  return { escalated, days, delivery };
}

export function startScheduler() {
  if (started) return;
  started = true;

  cron.schedule("* * * * *", async () => {
    try {
      await processOutbox({ limit: 20 });
    } catch (error) {
      console.error("[jobs] email outbox error:", error.message);
    }
  }, { timezone: env.CRON_TIMEZONE });

  cron.schedule("0 2 * * *", async () => {
    try {
      await runDeletionJob();
    } catch (error) {
      console.error("[jobs] deletion error:", error.message);
    }
  }, { timezone: env.CRON_TIMEZONE });

  cron.schedule("0 6 1 * *", async () => {
    try {
      await runMonthlyReportJob();
    } catch (error) {
      console.error("[jobs] monthly report error:", error.message);
    }
  }, { timezone: env.CRON_TIMEZONE });

  cron.schedule("0 8 * * *", async () => {
    try {
      await runEscalationJob();
    } catch (error) {
      console.error("[jobs] escalation error:", error.message);
    }
  }, { timezone: env.CRON_TIMEZONE });

  // Recover queued notifications after a restart without waiting a full minute.
  setTimeout(() => {
    processOutbox({ limit: 20 }).catch((error) => console.error("[jobs] startup outbox error:", error.message));
  }, 10_000).unref();

  console.log(`[jobs] scheduler started (${env.CRON_TIMEZONE})`);
}
