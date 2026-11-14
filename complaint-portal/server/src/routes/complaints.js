import express from "express";
import multer from "multer";
import crypto from "crypto";
import Complaint, { CATEGORIES } from "../models/Complaint.js";
import Contact from "../models/Contact.js";
import Institute from "../models/Institute.js";
import Attachment from "../models/Attachment.js";
import CaseEvent from "../models/CaseEvent.js";
import Member from "../models/Member.js";
import StatsMonthly from "../models/StatsMonthly.js";
import { generateRefId, isRefId } from "../utils/refId.js";
import { submissionSchema, patchComplaintSchema, URGENT_CATEGORY } from "../utils/validation.js";
import { verifyCaptcha } from "../services/captcha.js";
import { checkRateLimit } from "../utils/rateLimit.js";
import { hashIp, hashDeviceId, sha256 } from "../utils/hash.js";
import {
  queueComplaintNotifications,
  processOutbox,
} from "../services/email.js";
import { applyStatsDelta } from "../services/stats.js";
import { processImage, processVoice, processVideo, newStorageKey, saveObject, deleteObject } from "../services/storage.js";
import { audit } from "../utils/audit.js";
import { sanitizeText, normalizeEmail, normalizePhone, escapeRegex } from "../utils/sanitize.js";
import { requireAuth, requireCsrf, requireRole } from "../middleware/auth.js";
import { requestTimeSweep } from "../services/purge.js";
import { env } from "../config/env.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(env.MAX_IMAGE_BYTES * 6, env.MAX_VOICE_BYTES, env.MAX_VIDEO_BYTES),
    files: env.MAX_IMAGES + 2, // images + one voice + one video
    fields: 30,
    parts: 40,
  },
});

function rateLimited(res, limit, message) {
  res.set("Retry-After", String(limit.retryAfterSeconds));
  return res.status(429).json({ error: message });
}

function parseBody(body) {
  let contact = body.contact;
  if (typeof contact === "string") {
    try {
      contact = JSON.parse(contact);
    } catch {
      return { error: "Invalid contact information" };
    }
  }
  if (contact && typeof contact === "object" && Object.keys(contact).length === 0) contact = undefined;

  return {
    value: {
      institute_code: body.institute_code,
      category: body.category,
      details_text: body.details_text,
      urgent: body.urgent,
      mode: body.mode || "identified",
      captchaToken: body.captchaToken,
      captchaAnswer: body.captchaAnswer,
      deviceId: body.deviceId,
      contact,
      name: body.name,
      class_label: body.class_label,
      roll_no: body.roll_no,
      mobile: body.mobile,
      email: body.email,
    },
  };
}

async function cleanupStored(keys) {
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch (error) {
      console.error("[upload] cleanup failed:", error.message);
    }
  }
}

router.post("/", upload.fields([{ name: "images", maxCount: env.MAX_IMAGES }, { name: "voice", maxCount: 1 }, { name: "videos", maxCount: 1 }]), async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const parsedBody = parseBody(req.body || {});
    if (parsedBody.error) return res.status(400).json({ error: parsedBody.error });

    const parsed = submissionSchema.safeParse(parsedBody.value);
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".") || "form"] = issue.message;
      return res.status(400).json({ error: "Please check the highlighted fields", fields });
    }
    const data = parsed.data;

    const institute = await Institute.findOne({ code: data.institute_code, status: "active" }).lean();
    if (!institute) return res.status(400).json({ error: "Institute code could not be verified", fields: { institute_code: "Invalid or inactive institute code" } });

    const ipHash = hashIp(req.ip);
    const deviceHash = hashDeviceId(data.deviceId);
    const submitLimit = await checkRateLimit(
      `submit:ip:${ipHash}`,
      60 * 60 * 1000,
      env.RATE_LIMIT_SUBMIT_PER_IP_HOUR
    );
    if (!submitLimit.allowed) return rateLimited(res, submitLimit, "Too many complaints from this connection. Please try again later.");

    if (deviceHash) {
      const max = data.mode === "anonymous" ? env.RATE_LIMIT_ANON_PER_DEVICE_HOUR : env.RATE_LIMIT_SUBMIT_PER_DEVICE_HOUR;
      const deviceLimit = await checkRateLimit(`submit:device:${deviceHash}`, 60 * 60 * 1000, max);
      if (!deviceLimit.allowed) return rateLimited(res, deviceLimit, "Too many complaints from this device. Please try again later.");
    }

    if (data.mode === "anonymous") {
      const anonLimit = await checkRateLimit(
        `submit:anon:${ipHash}`,
        60 * 60 * 1000,
        env.RATE_LIMIT_ANON_PER_IP_HOUR
      );
      if (!anonLimit.allowed) return rateLimited(res, anonLimit, "Too many anonymous complaints. Please try again later.");
    }

    const captcha = await verifyCaptcha(data.captchaToken, req.ip, data.captchaAnswer);
    if (!captcha.ok) {
      return res.status(400).json({ error: captcha.error || "CAPTCHA verification failed", captchaFailed: true });
    }

    const imageFiles = req.files?.images || [];
    const voiceFiles = req.files?.voice || [];
    const videoFiles = req.files?.videos || [];
    if (imageFiles.length > env.MAX_IMAGES) return res.status(400).json({ error: `You can attach at most ${env.MAX_IMAGES} images` });
    if (voiceFiles.length > 1) return res.status(400).json({ error: "You can attach only one voice recording" });
    if (videoFiles.length > 1) return res.status(400).json({ error: "You can attach only one video" });
    const totalBytes = [...imageFiles, ...voiceFiles, ...videoFiles].reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > env.MAX_TOTAL_UPLOAD_BYTES) return res.status(413).json({ error: "The attachments are too large in total" });

    const processedFiles = [];
    try {
      for (const file of imageFiles) {
        const processed = await processImage(file.buffer);
        processedFiles.push({ ...processed, type: "image" });
      }
      if (voiceFiles[0]) {
        const processed = await processVoice(voiceFiles[0].buffer);
        processedFiles.push({ ...processed, type: "voice" });
      }
      if (videoFiles[0]) {
        const processed = await processVideo(videoFiles[0].buffer);
        processedFiles.push({ ...processed, type: "video" });
      }
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }

    const detailsText = sanitizeText(data.details_text, 5000);
    if (detailsText.length < 10) {
      return res.status(400).json({ error: "Please describe the complaint in at least 10 characters", fields: { details_text: "Description is too short" } });
    }
    const detailsHash = sha256(`${data.institute_code}|${detailsText}`);
    const duplicate = await checkRateLimit(
      `duplicate:${data.institute_code}:${detailsHash}`,
      env.DUPLICATE_WINDOW_MINUTES * 60 * 1000,
      1
    );
    if (!duplicate.allowed) {
      return res.status(409).json({
        error: "This complaint appears to have already been submitted recently. If you need to add information, use the status page follow-up option.",
      });
    }

    const category = data.urgent ? URGENT_CATEGORY : data.category;
    const contactInput = data.mode === "identified"
      ? data.contact || {
          name: data.name,
          class_label: data.class_label,
          roll_no: data.roll_no || "",
          mobile: data.mobile,
          email: data.email,
        }
      : null;

    const storedKeys = [];
    let complaint = null;
    try {
      for (const file of processedFiles) {
        const key = newStorageKey(file.type, file.ext);
        await saveObject(key, file.buffer, file.mime);
        storedKeys.push(key);
        file.storageKey = key;
      }

      const now = new Date();
      let refId = null;
      for (let attempt = 0; attempt < 8 && !complaint; attempt += 1) {
        refId = generateRefId(now);
        try {
          complaint = await Complaint.create({
            ref_id: refId,
            institute_code: data.institute_code,
            category,
            details_text: detailsText,
            details_hash: detailsHash,
            urgent: data.urgent,
            mode: data.mode,
            class_label: data.mode === "identified" ? sanitizeText(contactInput.class_label, 100) : undefined,
            status: "in_process",
            created_at: now,
          });
        } catch (error) {
          if (error?.code !== 11000) throw error;
        }
      }
      if (!complaint) throw Object.assign(new Error("Could not allocate a reference ID"), { status: 500 });

      if (data.mode === "identified") {
        await Contact.create({
          complaint_id: complaint._id,
          kind: "reporter",
          name: sanitizeText(contactInput.name, 100),
          roll_no: sanitizeText(contactInput.roll_no || "", 50) || undefined,
          mobile: normalizePhone(contactInput.mobile),
          email: normalizeEmail(contactInput.email),
        });
      }

      if (processedFiles.length) {
        await Attachment.insertMany(
          processedFiles.map((file) => ({
            complaint_id: complaint._id,
            type: file.type,
            storage_key: file.storageKey,
            mime: file.mime,
            size_bytes: file.buffer.length,
          }))
        );
      }
    } catch (error) {
      if (complaint?._id) {
        await Promise.all([
          Complaint.deleteOne({ _id: complaint._id }),
          Contact.deleteOne({ complaint_id: complaint._id }),
          Attachment.deleteMany({ complaint_id: complaint._id }),
        ]).catch(() => {});
      }
      await cleanupStored(storedKeys);
      throw error;
    }

    await applyStatsDelta(data.institute_code, {
      received: 1,
      category,
      categoryDelta: 1,
    });

    await audit({
      action: "complaint_created",
      entity: "complaint",
      entity_id: complaint.ref_id,
      detail: `mode=${data.mode}; urgent=${data.urgent}; attachments=${processedFiles.length}`,
      ip: req.ip,
    });

    try {
      await queueComplaintNotifications({
        complaint,
        reporterEmail: data.mode === "identified" ? normalizeEmail(contactInput.email) : null,
      });
      // Urgent alerts should not wait for the scheduled outbox worker.
      void processOutbox({ limit: data.urgent ? 10 : 3 }).catch((error) => {
        console.error("[email] outbox processing failed:", error.message);
      });
    } catch (error) {
      console.error("[email] could not queue complaint notification:", error.message);
    }

    res.status(201).json({
      ref_id: complaint.ref_id,
      message: "Complaint submitted successfully",
      acknowledgement_email: data.mode === "identified" && Boolean(normalizeEmail(contactInput.email)),
      attachments: processedFiles.length,
    });
  } catch (error) {
    next(error);
  }
});

function parsePositive(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

router.get("/", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    await requestTimeSweep();
    const page = parsePositive(req.query.page, 1);
    const limit = parsePositive(req.query.limit, 25, 100);
    const filter = { flagged_spam: false };

    if (req.query.institute_code) filter.institute_code = String(req.query.institute_code).toUpperCase();
    if (req.query.category && CATEGORIES.includes(String(req.query.category))) filter.category = String(req.query.category);
    if (req.query.status && ["in_process", "completed"].includes(String(req.query.status))) filter.status = String(req.query.status);
    if (req.query.urgent === "true") filter.urgent = true;
    if (req.query.spam === "true") filter.flagged_spam = true;
    else if (req.query.spam === "all") delete filter.flagged_spam;

    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 80);
      if (isRefId(search)) filter.ref_id = search.toUpperCase();
      else if (search) filter.ref_id = { $regex: `^${escapeRegex(search.toUpperCase())}`, $options: "i" };
    }

    const [items, total, summaryRaw] = await Promise.all([
      Complaint.find(filter)
        .select("ref_id institute_code category urgent mode status flagged_spam assigned_to created_at completed_at delete_after")
        .populate("assigned_to", "name")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Complaint.countDocuments(filter),
      Promise.all([
        Complaint.countDocuments({ flagged_spam: false }),
        Complaint.countDocuments({ flagged_spam: false, urgent: true, status: "in_process" }),
        Complaint.countDocuments({ flagged_spam: false, status: "in_process" }),
        Complaint.countDocuments({ flagged_spam: false, status: "completed" }),
      ]),
    ]);

    const [totalAll, urgentOpen, inProcess, completed] = summaryRaw;
    await audit({
      member_id: req.member._id,
      action: "complaint_list_view",
      entity: "complaint",
      detail: `page=${page}; limit=${limit}; results=${total}; filters=${JSON.stringify({
        institute_code: filter.institute_code || null,
        status: filter.status || null,
        category: filter.category || null,
        search: req.query.search ? "present" : null,
      })}`,
      ip: req.ip,
    });

    res.json({
      items: items.map((item) => ({
        ...item,
        assigned_to: item.assigned_to ? { id: item.assigned_to._id, name: item.assigned_to.name } : null,
      })),
      page,
      limit,
      total,
      summary: {
        total: totalAll,
        urgent: urgentOpen,
        in_process: inProcess,
        completed,
      },
    });
  } catch (error) {
    next(error);
  }
});

async function loadComplaintForStaff(refId) {
  const complaint = await Complaint.findOne({ ref_id: String(refId).toUpperCase() })
    .populate("assigned_to", "name email role")
    .lean();
  return complaint;
}

router.get("/:ref_id", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    await requestTimeSweep();
    const complaint = await loadComplaintForStaff(req.params.ref_id);
    if (!complaint) return res.status(404).json({ error: "Not found" });

    const contact = complaint.mode === "identified"
      ? await Contact.findOne({ complaint_id: complaint._id }).select("name roll_no mobile email created_at").lean()
      : null;
    const [attachments, events] = await Promise.all([
      Attachment.find({ complaint_id: complaint._id })
        .select("type mime size_bytes created_at")
        .sort({ created_at: 1 })
        .lean(),
      CaseEvent.find({ complaint_id: complaint._id })
        .sort({ occurred_at: 1 })
        .populate("member_id", "name")
        .lean(),
    ]);

    await audit({
      member_id: req.member._id,
      action: "complaint_detail_view",
      entity: "complaint",
      entity_id: complaint.ref_id,
      detail: `contacts=${contact ? 1 : 0}; attachments=${attachments.length}`,
      ip: req.ip,
    });

    delete complaint.details_hash;
    res.json({
      complaint: {
        ...complaint,
        assigned_to: complaint.assigned_to
          ? { id: complaint.assigned_to._id, name: complaint.assigned_to.name, email: complaint.assigned_to.email, role: complaint.assigned_to.role }
          : null,
      },
      contact,
      contacts: contact ? [contact] : [],
      attachments,
      events: events.map((event) => ({
        id: event._id,
        event: event.event,
        note: event.note,
        occurred_at: event.occurred_at,
        member: event.member_id ? { id: event.member_id._id, name: event.member_id.name } : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:ref_id", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsed = patchComplaintSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.issues) fields[issue.path.join(".") || "form"] = issue.message;
      return res.status(400).json({ error: "Please check the supplied values", fields });
    }
    const data = parsed.data;

    let complaint = await Complaint.findOne({ ref_id: String(req.params.ref_id).toUpperCase() });
    if (!complaint) return res.status(404).json({ error: "Not found" });

    if (typeof data.completed === "boolean") {
      const now = new Date();
      if (data.completed && complaint.status !== "completed") {
        const updated = await Complaint.findOneAndUpdate(
          { _id: complaint._id, status: "in_process" },
          { $set: { status: "completed", completed_at: now, delete_after: new Date(now.getTime() + env.RETENTION_DAYS * 86400000) } },
          { returnDocument: "after" }
        );
        if (updated) {
          complaint = updated;
          // Spam-flagged cases are excluded from statistics, including completion counts.
          if (!complaint.flagged_spam) await applyStatsDelta(complaint.institute_code, { completed: 1 });
          await CaseEvent.create({ complaint_id: complaint._id, member_id: req.member._id, event: "completed" });
          await audit({
            member_id: req.member._id,
            action: "complaint_completed",
            entity: "complaint",
            entity_id: complaint.ref_id,
            detail: `retention_days=${env.RETENTION_DAYS}`,
            ip: req.ip,
          });
        }
      } else if (!data.completed && complaint.status === "completed") {
        const updated = await Complaint.findOneAndUpdate(
          { _id: complaint._id, status: "completed" },
          { $set: { status: "in_process" }, $unset: { completed_at: "", delete_after: "" } },
          { returnDocument: "after" }
        );
        if (updated) {
          complaint = updated;
          if (!complaint.flagged_spam) await applyStatsDelta(complaint.institute_code, { completed: -1 });
          await CaseEvent.create({ complaint_id: complaint._id, member_id: req.member._id, event: "reopened" });
          await audit({
            member_id: req.member._id,
            action: "complaint_reopened",
            entity: "complaint",
            entity_id: complaint.ref_id,
            ip: req.ip,
          });
        }
      }
    }

    if (typeof data.flagged_spam === "boolean" && data.flagged_spam !== complaint.flagged_spam) {
      const updated = await Complaint.findOneAndUpdate(
        { _id: complaint._id, flagged_spam: { $ne: data.flagged_spam } },
        { $set: { flagged_spam: data.flagged_spam } },
        { returnDocument: "after" }
      );
      if (updated) {
        complaint = updated;
        const direction = data.flagged_spam ? -1 : 1;
        await applyStatsDelta(complaint.institute_code, {
          received: direction,
          category: complaint.category,
          categoryDelta: direction,
          completed: complaint.status === "completed" ? direction : 0,
        });
        await CaseEvent.create({
          complaint_id: complaint._id,
          member_id: req.member._id,
          event: data.flagged_spam ? "flagged_spam" : "unflagged_spam",
        });
        await audit({
          member_id: req.member._id,
          action: data.flagged_spam ? "complaint_flagged_spam" : "complaint_unflagged_spam",
          entity: "complaint",
          entity_id: complaint.ref_id,
          ip: req.ip,
        });
      }
    }

    if (data.assigned_to !== undefined) {
      let assignee = null;
      if (data.assigned_to) {
        assignee = await Member.findOne({ _id: data.assigned_to, status: "active" }).select("_id name").lean();
        if (!assignee) return res.status(400).json({ error: "Assigned member is not active", fields: { assigned_to: "Select an active staff member" } });
      }
      complaint = await Complaint.findByIdAndUpdate(
        complaint._id,
        data.assigned_to ? { $set: { assigned_to: assignee._id } } : { $unset: { assigned_to: "" } },
        { returnDocument: "after" }
      );
      await CaseEvent.create({
        complaint_id: complaint._id,
        member_id: req.member._id,
        event: assignee ? "assigned" : "unassigned",
      });
      await audit({
        member_id: req.member._id,
        action: "complaint_assignment_changed",
        entity: "complaint",
        entity_id: complaint.ref_id,
        detail: assignee ? `assignee=${assignee._id}` : "unassigned",
        ip: req.ip,
      });
    }

    if (data.note) {
      const note = sanitizeText(data.note, 5000);
      await CaseEvent.create({ complaint_id: complaint._id, member_id: req.member._id, event: "note", note });
      await audit({
        member_id: req.member._id,
        action: "complaint_note_added",
        entity: "complaint",
        entity_id: complaint.ref_id,
        ip: req.ip,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
