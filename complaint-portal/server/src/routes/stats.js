import express from "express";
import Institute from "../models/Institute.js";
import Complaint from "../models/Complaint.js";
import StatsMonthly from "../models/StatsMonthly.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getInstituteTotals } from "../services/stats.js";
import { instituteCodeSchema } from "../utils/validation.js";
import { audit } from "../utils/audit.js";

const router = express.Router();

// College leaderboard — kounse college se kitni complaints. case_team (teachers) sees only this.
router.get("/leaderboard", requireAuth, requireRole("owner", "case_team"), async (req, res, next) => {
  try {
    // Anonymous complaints are an owner-only concern: teacher counts are built
    // from identified reports only, so the anonymous volume stays private.
    const includeAnonymous = req.member.role === "owner";
    const [rows, institutes] = await Promise.all([
      Complaint.aggregate([
        { $match: includeAnonymous ? { flagged_spam: false } : { flagged_spam: false, mode: "identified" } },
        {
          $group: {
            _id: "$institute_code",
            total: { $sum: 1 },
            in_process: { $sum: { $cond: [{ $eq: ["$status", "in_process"] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          },
        },
      ]),
      Institute.find({ status: "active" }).select("code name type").lean(),
    ]);
    await audit({
      member_id: req.member._id,
      action: "leaderboard_viewed",
      entity: "institute",
      entity_id: null,
      ip: req.ip,
    });

    // Every generated ref ID stays on the board (even with zero complaints) so
    // the code ↔ college register is always visible. Complaint codes that are
    // no longer active keep showing as "(inactive or archived)".
    const byCode = new Map(institutes.map((institute) => [institute.code, institute]));
    const stats = new Map(rows.map((row) => [row._id, row]));
    const codes = new Set([...byCode.keys(), ...stats.keys()]);
    const merged = [...codes].map((code) => {
      const row = stats.get(code) || { total: 0, in_process: 0, completed: 0 };
      const institute = byCode.get(code);
      return {
        code,
        name: institute?.name || `${code} (inactive or archived)`,
        type: institute?.type || "other",
        total: row.total,
        in_process: row.in_process,
        completed: row.completed,
      };
    });
    merged.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    // Teachers see only their own college's row — the full board is an owner
    // view. A teacher without an institute sees nothing.
    const scoped = req.member.role === "owner"
      ? merged
      : merged.filter((row) => row.code === req.member.institute_code);

    res.json({
      leaderboard: scoped.map((row, index) => ({ rank: index + 1, ...row })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/institutes", requireAuth, async (req, res, next) => {
  try {
    const [institutes, complaintCodes] = await Promise.all([
      Institute.find({ status: "active" }).select("code name type").sort({ name: 1 }).lean(),
      Complaint.distinct("institute_code"),
    ]);
    const byCode = new Map(institutes.map((institute) => [institute.code, institute]));
    for (const code of complaintCodes) {
      if (!byCode.has(code)) byCode.set(code, { code, name: `${code} (inactive or archived)`, type: "other" });
    }
    res.json({
      institutes: [...byCode.values()].map((institute) => ({
        code: institute.code,
        name: institute.name,
        type: institute.type,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/institute/:code", requireAuth, async (req, res, next) => {
  try {
    const parsed = instituteCodeSchema.safeParse(req.params.code);
    if (!parsed.success) return res.status(400).json({ error: "Invalid institute code" });
    const code = parsed.data;
    const [institute, totals] = await Promise.all([
      Institute.findOne({ code }).select("code name type").lean(),
      getInstituteTotals(code),
    ]);
    await audit({
      member_id: req.member._id,
      action: "institute_stats_viewed",
      entity: "institute",
      entity_id: code,
      ip: req.ip,
    });
    res.json({
      institute: institute || { code, name: `${code} (not in active institute list)`, type: "other" },
      received: totals.received,
      completed: totals.completed,
      in_process: totals.in_process,
      escalated: totals.escalated,
      months: totals.rows.map((row) => ({
        month: row.month,
        received: row.received || 0,
        completed: row.completed || 0,
        escalated: row.escalated || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/monthly", requireAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.institute_code) {
      const parsed = instituteCodeSchema.safeParse(req.query.institute_code);
      if (!parsed.success) return res.status(400).json({ error: "Invalid institute code" });
      filter.institute_code = parsed.data;
    }
    const rows = await StatsMonthly.find(filter).sort({ month: -1, institute_code: 1 }).lean();
    res.json({
      rows: rows.map((row) => ({
        institute_code: row.institute_code,
        month: row.month,
        received: row.received || 0,
        completed: row.completed || 0,
        escalated: row.escalated || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/overview", requireAuth, async (req, res, next) => {
  try {
    const base = { flagged_spam: false };
    const [total, urgent, inProcess, completed, recent] = await Promise.all([
      Complaint.countDocuments(base),
      Complaint.countDocuments({ ...base, urgent: true, status: "in_process" }),
      Complaint.countDocuments({ ...base, status: "in_process" }),
      Complaint.countDocuments({ ...base, status: "completed" }),
      Complaint.find(base)
        .select("ref_id institute_code category urgent status created_at")
        .sort({ created_at: -1 })
        .limit(6)
        .lean(),
    ]);
    res.json({
      summary: { total, urgent, in_process: inProcess, completed },
      recent,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
