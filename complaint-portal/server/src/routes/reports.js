import express from "express";
import { requireAuth, requireCsrf, requireRole } from "../middleware/auth.js";
import { buildMonthlyReportData, buildMonthlyReportPdf } from "../services/monthlyReport.js";
import { queueMonthlyReport, processOutbox } from "../services/email.js";
import { instituteCodeSchema, monthSchema } from "../utils/validation.js";
import { audit } from "../utils/audit.js";

const router = express.Router();

router.get("/preview", requireAuth, async (req, res, next) => {
  try {
    const code = instituteCodeSchema.safeParse(req.query.institute_code || "");
    const month = monthSchema.safeParse(req.query.month || "");
    if (!code.success || !month.success) return res.status(400).json({ error: "A valid institute code and month (YYYY-MM) are required" });
    const report = await buildMonthlyReportPdf(code.data, month.data);
    await audit({
      member_id: req.member._id,
      action: "monthly_report_previewed",
      entity: "institute",
      entity_id: code.data,
      detail: `month=${month.data}`,
      ip: req.ip,
    });
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="apthex-monthly-${month.data}.pdf"`);
    res.set("Cache-Control", "no-store");
    res.send(report.pdf);
  } catch (error) {
    next(error);
  }
});

router.get("/data", requireAuth, async (req, res, next) => {
  try {
    const code = instituteCodeSchema.safeParse(req.query.institute_code || "");
    const month = monthSchema.safeParse(req.query.month || "");
    if (!code.success || !month.success) return res.status(400).json({ error: "A valid institute code and month (YYYY-MM) are required" });
    const data = await buildMonthlyReportData(code.data, month.data);
    res.json({
      institute: data.institute ? { code: data.institute.code, name: data.institute.name, head_email_configured: Boolean(data.institute.head_email) } : null,
      month: data.month,
      received: data.received,
      completed: data.completed,
      in_process: data.inProcess,
      escalated: data.escalated,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/send", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const code = instituteCodeSchema.safeParse(req.body?.institute_code || "");
    const month = monthSchema.safeParse(req.body?.month || "");
    if (!code.success || !month.success) return res.status(400).json({ error: "A valid institute code and month (YYYY-MM) are required" });
    const data = await buildMonthlyReportData(code.data, month.data);
    if (!data.institute) return res.status(404).json({ error: "Institute not found" });
    if (!data.institute.head_email) return res.status(400).json({ error: "The institute head email is not configured" });

    const dedupeSuffix = req.body?.force ? `:manual:${Date.now()}` : "";
    await queueMonthlyReport({
      institute: data.institute,
      month: data.month,
      received: data.received,
      completed: data.completed,
      inProcess: data.inProcess,
      dedupeSuffix,
    });
    void processOutbox({ limit: 5 }).catch((error) => console.error("[email] outbox processing failed:", error.message));
    await audit({
      member_id: req.member._id,
      action: "monthly_report_queued",
      entity: "institute",
      entity_id: code.data,
      detail: `month=${data.month}; manual=${Boolean(req.body?.force)}`,
      ip: req.ip,
    });
    res.json({ ok: true, queued: true });
  } catch (error) {
    next(error);
  }
});

export default router;
