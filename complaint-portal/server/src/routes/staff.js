import express from "express";
import bcrypt from "bcrypt";
import Member from "../models/Member.js";
import AuditEvent from "../models/AuditEvent.js";
import EmailOutbox from "../models/EmailOutbox.js";
import {
  requireAuth,
  requireCsrf,
  requireRole,
  revokeAllSessionsForMember,
  clearSessionCookies,
  publicMember,
} from "../middleware/auth.js";
import { memberCreateSchema, memberUpdateSchema, passwordResetSchema, TEACHER_DEFAULT_PASSWORD } from "../utils/validation.js";
import { audit } from "../utils/audit.js";
import { processOutbox, queueEmail } from "../services/email.js";
import { maskEmail } from "../utils/sanitize.js";
import { sha256 } from "../utils/hash.js";

const router = express.Router();

function fieldsFrom(error) {
  const fields = {};
  for (const issue of error.issues) fields[issue.path.join(".") || "form"] = issue.message;
  return fields;
}

function parsePositive(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

router.get("/assignable", requireAuth, async (req, res, next) => {
  try {
    const members = await Member.find({ status: "active" }).select("name role").sort({ name: 1 }).lean();
    res.json({ members: members.map((member) => ({ id: String(member._id), name: member.name, role: member.role })) });
  } catch (error) {
    next(error);
  }
});

router.get("/members", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const members = await Member.find()
      .select("name email role status totp_enabled last_login_at created_at")
      .sort({ created_at: 1 })
      .lean();
    res.set("Cache-Control", "no-store");
    res.json({
      members: members.map((member) => ({
        ...member,
        id: String(member._id),
        _id: undefined,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/members", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsed = memberCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Please check the member details", fields: fieldsFrom(parsed.error) });
    const { name, email, role } = parsed.data;
    // Blank password + case_team => standard teacher password (TEACHER_DEFAULT_PASSWORD).
    const password = parsed.data.password || (role === "case_team" ? TEACHER_DEFAULT_PASSWORD : null);
    if (!password) return res.status(400).json({ error: "Owner accounts need a password", fields: { password: "Password is required for owner accounts" } });
    const existing = await Member.exists({ email });
    if (existing) return res.status(409).json({ error: "A member with this email already exists" });

    const password_hash = await bcrypt.hash(password, 12);
    const member = await Member.create({ name, email, password_hash, role, status: "active" });
    await audit({
      member_id: req.member._id,
      action: "staff_member_created",
      entity: "member",
      entity_id: String(member._id),
      detail: `role=${role}`,
      ip: req.ip,
    });
    res.status(201).json({ member: publicMember(member) });
  } catch (error) {
    next(error);
  }
});

router.patch("/members/:id", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsed = memberUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Please check the member details", fields: fieldsFrom(parsed.error) });
    const target = await Member.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "Not found" });

    const data = parsed.data;
    const willBeInactive = data.status === "inactive";
    const willBeCaseTeam = data.role === "case_team";

    if (String(target._id) === String(req.member._id) && willBeInactive) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    if ((target.role === "owner" && target.status === "active") && (willBeInactive || willBeCaseTeam)) {
      const activeOwners = await Member.countDocuments({ role: "owner", status: "active" });
      if (activeOwners <= 1) {
        return res.status(400).json({ error: "At least one active owner must remain" });
      }
    }

    if (data.name !== undefined) target.name = data.name;
    if (data.role !== undefined) target.role = data.role;
    if (data.status !== undefined) target.status = data.status;
    await target.save();

    if (willBeInactive) await revokeAllSessionsForMember(target._id, "member_deactivated");

    await audit({
      member_id: req.member._id,
      action: "staff_member_updated",
      entity: "member",
      entity_id: String(target._id),
      detail: `role=${target.role}; status=${target.status}`,
      ip: req.ip,
    });
    res.json({ member: publicMember(target) });
  } catch (error) {
    next(error);
  }
});

router.post("/members/:id/reset-password", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const parsed = passwordResetSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Please check the password", fields: fieldsFrom(parsed.error) });
    const target = await Member.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "Not found" });
    target.password_hash = await bcrypt.hash(parsed.data.password, 12);
    target.failed_login_count = 0;
    target.locked_until = undefined;
    // A password reset invalidates enrolled 2FA; the member must enrol again.
    target.totp_enabled = false;
    target.totp_secret = undefined;
    target.totp_pending_secret = undefined;
    target.totp_setup_token_hash = undefined;
    target.totp_setup_expires = undefined;
    await target.save();
    await revokeAllSessionsForMember(target._id, "password_reset");
    if (String(target._id) === String(req.member._id)) clearSessionCookies(res);
    await audit({
      member_id: req.member._id,
      action: "staff_password_reset",
      entity: "member",
      entity_id: String(target._id),
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/members/:id/revoke-sessions", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const target = await Member.findById(req.params.id).select("_id");
    if (!target) return res.status(404).json({ error: "Not found" });
    await revokeAllSessionsForMember(target._id, "owner_revoked_sessions");
    if (String(target._id) === String(req.member._id)) clearSessionCookies(res);
    await audit({
      member_id: req.member._id,
      action: "staff_sessions_revoked_by_owner",
      entity: "member",
      entity_id: String(target._id),
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/audit", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const page = parsePositive(req.query.page, 1);
    const limit = parsePositive(req.query.limit, 50, 100);
    const filter = {};
    if (req.query.action) filter.action = String(req.query.action).slice(0, 80);
    if (req.query.entity) filter.entity = String(req.query.entity).slice(0, 80);
    if (req.query.outcome === "success" || req.query.outcome === "failure") filter.outcome = req.query.outcome;
    const [items, total] = await Promise.all([
      AuditEvent.find(filter)
        .sort({ occurred_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("member_id", "name email")
        .lean(),
      AuditEvent.countDocuments(filter),
    ]);
    await audit({
      member_id: req.member._id,
      action: "audit_log_viewed",
      entity: "audit_event",
      detail: `page=${page}; results=${total}`,
      ip: req.ip,
    });
    res.set("Cache-Control", "no-store");
    res.json({
      items: items.map((event) => ({
        id: String(event._id),
        occurred_at: event.occurred_at,
        action: event.action,
        entity: event.entity,
        entity_id: event.entity_id,
        outcome: event.outcome,
        ip_hash: event.ip,
        detail: event.detail,
        member: event.member_id ? { name: event.member_id.name, email: maskEmail(event.member_id.email) } : null,
      })),
      page,
      limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/outbox", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const page = parsePositive(req.query.page, 1);
    const limit = parsePositive(req.query.limit, 50, 100);
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).slice(0, 30);
    if (req.query.kind) filter.kind = String(req.query.kind).slice(0, 30);
    const [items, total] = await Promise.all([
      EmailOutbox.find(filter)
        .select("to subject kind status attempts provider_message_id created_at sent_at last_error next_attempt_at")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailOutbox.countDocuments(filter),
    ]);
    await audit({
      member_id: req.member._id,
      action: "email_outbox_viewed",
      entity: "email_outbox",
      detail: `page=${page}; results=${total}`,
      ip: req.ip,
    });
    res.set("Cache-Control", "no-store");
    res.json({
      items: items.map((message) => ({ ...message, to: maskEmail(message.to) })),
      page,
      limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/outbox/process", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const summary = await processOutbox({ limit: 25 });
    await audit({
      member_id: req.member._id,
      action: "email_outbox_processed",
      entity: "email_outbox",
      detail: JSON.stringify(summary),
      ip: req.ip,
    });
    res.json({ ok: true, summary });
  } catch (error) {
    next(error);
  }
});

// Owner "email ka chalta hai kya?" self-test: ek test mail queue karta hai jo
// scheduler turant process karta hai. Email log page me iska status dikhta hai.
router.post("/outbox/test", requireAuth, requireCsrf, requireRole("owner"), async (req, res, next) => {
  try {
    const to = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: "Enter a valid email address to send the test to", fields: { email: "Valid email required" } });
    }
    const now = new Date();
    await queueEmail({
      dedupeKey: `test:${now.getTime()}:${sha256(to).slice(0, 12)}`,
      to,
      subject: "APTHEX portal — email delivery test",
      html: "<p>This is a test email from the APTHEX complaint portal. If you received it, the email setup is working.</p>",
      text: "This is a test email from the APTHEX complaint portal. If you received it, the email setup is working.",
      kind: "test",
    });
    await audit({
      member_id: req.member._id,
      action: "email_test_queued",
      entity: "email_outbox",
      detail: `to=${to}`,
      ip: req.ip,
    });
    res.json({ ok: true, to, note: "Queued. Check the Email log in a few seconds — status should be sent (or dev_logged in development)." });
  } catch (error) {
    next(error);
  }
});

export default router;
