import express from "express";
import Complaint from "../models/Complaint.js";
import DeletionLog from "../models/DeletionLog.js";
import CaseEvent from "../models/CaseEvent.js";
import { statusLookupSchema, followupSchema } from "../utils/validation.js";
import { checkRateLimit } from "../utils/rateLimit.js";
import { hashIp, hashDeviceId } from "../utils/hash.js";
import { verifyCaptcha } from "../services/captcha.js";
import { purgeIfDue } from "../services/purge.js";
import { sanitizeText } from "../utils/sanitize.js";
import { audit } from "../utils/audit.js";
import { env } from "../config/env.js";

const router = express.Router();

function rateLimited(res, limit, message) {
  res.set("Retry-After", String(limit.retryAfterSeconds));
  return res.status(429).json({ error: message });
}

const DELETED_MESSAGE =
  "This case is completed and its complaint data has been deleted in line with the approved retention policy. No further information is available.";

router.post("/lookup", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const parsed = statusLookupSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(404).json({ error: "Complaint not found. Check the reference ID." });
    }
    const ipHash = hashIp(req.ip);
    const limit = await checkRateLimit(
      `status:${ipHash}`,
      60 * 1000,
      env.RATE_LIMIT_STATUS_PER_IP_MINUTE
    );
    if (!limit.allowed) return rateLimited(res, limit, "Too many status checks. Please wait a minute and try again.");

    const refId = parsed.data.ref_id;
    await purgeIfDue(refId);
    const complaint = await Complaint.findOne({ ref_id: refId }).select("status").lean();
    if (complaint) {
      return res.json({ status: complaint.status === "completed" ? "Completed" : "In Process" });
    }

    const deletion = await DeletionLog.findOne({ ref_id: refId }).select("_id").lean();
    if (deletion) {
      return res.json({ status: "Completed", data_deleted: true, message: DELETED_MESSAGE });
    }
    return res.status(404).json({ error: "Complaint not found. Check the reference ID." });
  } catch (error) {
    next(error);
  }
});

router.post("/followup", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const parsed = followupSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".") || "form"] = issue.message;
      return res.status(400).json({ error: "Please check the follow-up details", fields });
    }
    const { ref_id: refId, text, captchaToken, deviceId } = parsed.data;

    const ipHash = hashIp(req.ip);
    const limit = await checkRateLimit(
      `followup:${ipHash}`,
      60 * 60 * 1000,
      env.RATE_LIMIT_FOLLOWUP_PER_HOUR
    );
    if (!limit.allowed) return rateLimited(res, limit, "Too many follow-ups. Please try again later.");
    const perRef = await checkRateLimit(`followup:ref:${refId}`, 60 * 60 * 1000, env.RATE_LIMIT_FOLLOWUP_PER_HOUR);
    if (!perRef.allowed) return rateLimited(res, perRef, "Too many follow-ups for this reference ID. Please try again later.");
    const deviceHash = hashDeviceId(deviceId);
    if (deviceHash) {
      const deviceLimit = await checkRateLimit(`followup:device:${deviceHash}`, 60 * 60 * 1000, env.RATE_LIMIT_FOLLOWUP_PER_HOUR);
      if (!deviceLimit.allowed) return rateLimited(res, deviceLimit, "Too many follow-ups from this device. Please try again later.");
    }

    const captcha = await verifyCaptcha(captchaToken, req.ip, parsed.data.captchaAnswer);
    if (!captcha.ok) return res.status(400).json({ error: captcha.error || "CAPTCHA verification failed", captchaFailed: true });

    await purgeIfDue(refId);
    const complaint = await Complaint.findOne({ ref_id: refId }).select("_id ref_id").lean();
    if (!complaint) {
      const deletion = await DeletionLog.findOne({ ref_id: refId }).select("_id").lean();
      if (deletion) return res.status(410).json({ error: DELETED_MESSAGE, data_deleted: true });
      return res.status(404).json({ error: "Complaint not found. Check the reference ID." });
    }

    const note = sanitizeText(text, 5000);
    if (note.length < 5) return res.status(400).json({ error: "Please enter at least 5 characters" });

    await CaseEvent.create({
      complaint_id: complaint._id,
      member_id: null,
      event: "reporter_followup",
      note,
    });
    await audit({
      action: "reporter_followup",
      entity: "complaint",
      entity_id: complaint.ref_id,
      detail: "followup submitted through public status page",
      ip: req.ip,
    });
    res.status(201).json({ ok: true, message: "Follow-up submitted to the APTHEX case team." });
  } catch (error) {
    next(error);
  }
});

export default router;
