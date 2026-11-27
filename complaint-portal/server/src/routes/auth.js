import express from "express";
import bcrypt from "bcrypt";
import Member from "../models/Member.js";
import StaffSession from "../models/StaffSession.js";
import {
  createStaffSession,
  requireAuth,
  requireCsrf,
  requireTrustedOrigin,
  clearSessionCookies,
  ensureCsrfToken,
  publicMember,
  revokeSession,
  revokeAllSessionsForMember,
  CSRF_COOKIE,
  SESSION_COOKIE,
} from "../middleware/auth.js";
import { loginSchema, setupSchema, changePasswordSchema } from "../utils/validation.js";
import { newSecret, verifyToken, encryptSecret, decryptSecret } from "../utils/totp.js";
import { audit } from "../utils/audit.js";
import { checkRateLimit } from "../utils/rateLimit.js";
import { hashIp, randomToken, sha256, timingSafeEqual } from "../utils/hash.js";
import { env } from "../config/env.js";

const router = express.Router();

function fieldsFrom(error) {
  const fields = {};
  for (const issue of error.issues) fields[issue.path.join(".") || "form"] = issue.message;
  return fields;
}

async function registerFailure(member, req, reason) {
  if (member) {
    const nextCount = (member.failed_login_count || 0) + 1;
    const update = { $inc: { failed_login_count: 1 } };
    if (nextCount >= 5) update.$set = { locked_until: new Date(Date.now() + 15 * 60 * 1000) };
    await Member.updateOne({ _id: member._id }, update);
    await audit({
      member_id: member._id,
      action: "staff_login",
      entity: "member",
      entity_id: String(member._id),
      outcome: "failure",
      detail: reason,
      ip: req.ip,
    });
  } else {
    await audit({
      action: "staff_login",
      entity: "member",
      outcome: "failure",
      detail: reason,
      ip: req.ip,
    });
  }
}

router.post("/login", requireTrustedOrigin, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password", fields: fieldsFrom(parsed.error) });
    const { email, password, code } = parsed.data;

    const maxAttempts = env.NODE_ENV === "production" ? env.RATE_LIMIT_LOGIN_PER_15_MIN : 100;
    const limit = await checkRateLimit(
      `login:${hashIp(req.ip)}:${email ? sha256(email) : "pw"}`,
      15 * 60 * 1000,
      maxAttempts
    );
    if (!limit.allowed) {
      res.set("Retry-After", String(limit.retryAfterSeconds));
      return res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
    }

    // Password-only sign-in with institute code support.
    // If institute code (code) is provided, teacher is found by institute_code + password.
    // Otherwise, falls back to searching all owners then teachers by password.
    let member = null;
    if (email) {
      // Email path kept for API compatibility and a future 2FA re-enable.
      member = await Member.findOne({ email });
    } else if (code) {
      // Institute code path: find teacher by institute_code + verify password
      const teachers = await Member.find({ role: "case_team", institute_code: code.toUpperCase().trim(), status: "active" });
      for (const candidate of teachers) {
        if (await bcrypt.compare(password, candidate.password_hash)) {
          member = candidate;
          break;
        }
      }
    } else {
      // Fallback: search all owners then teachers by password (no institute code)
      const owners = await Member.find({ role: "owner", status: "active" }).sort({ created_at: 1 });
      const teachers = await Member.find({ role: "case_team", status: "active" }).sort({ created_at: 1 });
      for (const candidate of [...owners, ...teachers]) {
        if (await bcrypt.compare(password, candidate.password_hash)) {
          member = candidate;
          break;
        }
      }
    }
    if (!member || member.status !== "active") {
      await registerFailure(null, req, "unknown_or_inactive");
      return res.status(401).json({ error: "Incorrect password. Try again." });
    }
    if (member.locked_until && member.locked_until > new Date()) {
      return res.status(423).json({ error: "Account is temporarily locked due to multiple failed attempts. Try again in a few minutes." });
    }

    const validPassword = await bcrypt.compare(password, member.password_hash);
    if (!validPassword) {
      await registerFailure(member, req, "bad_password");
      return res.status(401).json({ error: "Incorrect password. Try again." });
    }

    // When AUTH_REQUIRE_2FA is false (dev/demo), skip both QR setup and code
    // verification — password alone creates the session.
    if (env.AUTH_REQUIRE_2FA && !member.totp_enabled) {
      const { secret, otpauthUrl } = newSecret(member.email);
      const setupToken = randomToken(32);
      member.totp_pending_secret = encryptSecret(secret);
      member.totp_setup_token_hash = sha256(setupToken);
      member.totp_setup_expires = new Date(Date.now() + 10 * 60 * 1000);
      member.failed_login_count = 0;
      member.locked_until = undefined;
      await member.save();
      await audit({
        member_id: member._id,
        action: "staff_2fa_setup_started",
        entity: "member",
        entity_id: String(member._id),
        ip: req.ip,
      });
      return res.json({
        setupRequired: true,
        setupToken,
        secret,
        otpauthUrl,
        member: { name: member.name, email: member.email },
        message: "Set up an authenticator app before accessing the Case Desk.",
      });
    }

    if (env.AUTH_REQUIRE_2FA) {
      if (!code) {
        return res.status(400).json({ error: "Enter your 6-digit authenticator code", twoFactorRequired: true });
      }
      const secret = decryptSecret(member.totp_secret);
      if (!verifyToken(secret, code)) {
        await registerFailure(member, req, "bad_totp");
        return res.status(401).json({ error: "Invalid authenticator code", twoFactorRequired: true });
      }
    }

    member.failed_login_count = 0;
    member.locked_until = undefined;
    member.last_login_at = new Date();
    await member.save();
    const { csrfToken } = await createStaffSession(member, res);
    await audit({
      member_id: member._id,
      action: "staff_login",
      entity: "member",
      entity_id: String(member._id),
      outcome: "success",
      ip: req.ip,
    });
    res.json({ ok: true, member: publicMember(member), csrfToken });
  } catch (error) {
    next(error);
  }
});

router.post("/setup-2fa", requireTrustedOrigin, async (req, res, next) => {
  try {
    const parsed = setupSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Enter the setup token and authenticator code", fields: fieldsFrom(parsed.error) });
    const { email, setupToken, code } = parsed.data;

    const member = await Member.findOne({ email });
    if (!member || member.status !== "active" || !member.totp_setup_token_hash || !member.totp_setup_expires) {
      return res.status(400).json({ error: "Two-factor setup is not pending. Sign in again." });
    }
    if (member.totp_setup_expires < new Date()) {
      return res.status(400).json({ error: "The two-factor setup window has expired. Sign in again." });
    }
    if (!timingSafeEqual(sha256(setupToken), member.totp_setup_token_hash)) {
      await audit({
        member_id: member._id,
        action: "staff_2fa_setup",
        entity: "member",
        entity_id: String(member._id),
        outcome: "failure",
        detail: "invalid_setup_token",
        ip: req.ip,
      });
      return res.status(401).json({ error: "Two-factor setup could not be verified. Sign in again." });
    }

    const secret = decryptSecret(member.totp_pending_secret);
    if (!verifyToken(secret, code)) {
      await audit({
        member_id: member._id,
        action: "staff_2fa_setup",
        entity: "member",
        entity_id: String(member._id),
        outcome: "failure",
        detail: "invalid_totp",
        ip: req.ip,
      });
      return res.status(401).json({ error: "Invalid authenticator code" });
    }

    member.totp_secret = encryptSecret(secret);
    member.totp_enabled = true;
    member.totp_pending_secret = undefined;
    member.totp_setup_token_hash = undefined;
    member.totp_setup_expires = undefined;
    member.failed_login_count = 0;
    member.locked_until = undefined;
    member.last_login_at = new Date();
    await member.save();

    const { csrfToken } = await createStaffSession(member, res);
    await audit({
      member_id: member._id,
      action: "staff_2fa_enabled",
      entity: "member",
      entity_id: String(member._id),
      ip: req.ip,
    });
    res.json({ ok: true, member: publicMember(member), csrfToken });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Please check your password", fields: fieldsFrom(parsed.error) });
    const { current_password, new_password } = parsed.data;

    const valid = await bcrypt.compare(current_password, req.member.password_hash);
    if (!valid) {
      return res.status(400).json({ error: "Current password does not match", fields: { current_password: "Incorrect current password" } });
    }

    const member = await Member.findById(req.member._id);
    if (!member) return res.status(404).json({ error: "Member not found" });

    member.password_hash = await bcrypt.hash(new_password, 12);
    member.last_password_issued = new_password;
    await member.save();

    await audit({
      member_id: member._id,
      action: "staff_password_changed_by_self",
      entity: "member",
      entity_id: String(member._id),
      ip: req.ip,
    });

    res.json({ ok: true, message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/update-profile", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const { email, current_password, new_password } = req.body || {};
    const member = await Member.findById(req.member._id);
    if (!member) return res.status(404).json({ error: "Member not found" });

    let updated = false;

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: "Current password is required to change password." });
      }
      const valid = await bcrypt.compare(current_password, member.password_hash);
      if (!valid) {
        return res.status(400).json({ error: "Current password does not match." });
      }
      if (new_password.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long." });
      }
      member.password_hash = await bcrypt.hash(new_password, 12);
      member.last_password_issued = new_password;
      updated = true;
    }

    if (email && typeof email === "string" && email.trim().toLowerCase() !== member.email) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }
      const existing = await Member.findOne({ email: trimmedEmail, _id: { $ne: member._id } });
      if (existing) {
        return res.status(400).json({ error: "This email is already in use by another account." });
      }
      member.email = trimmedEmail;
      updated = true;
    }

    if (!updated) {
      return res.status(400).json({ error: "No changes provided." });
    }

    await member.save();
    await audit({
      member_id: member._id,
      action: "staff_profile_updated",
      entity: "member",
      entity_id: String(member._id),
      ip: req.ip,
    });

    res.json({ ok: true, message: "Profile updated successfully.", member: publicMember(member) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    await revokeSession(req.staffSession, "logout");
    clearSessionCookies(res);
    await audit({
      member_id: req.member._id,
      action: "staff_logout",
      entity: "member",
      entity_id: String(req.member._id),
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const csrfToken = await ensureCsrfToken(req, res);
    res.set("Cache-Control", "no-store");
    res.json({
      member: publicMember(req.member),
      csrfToken,
      session: {
        id: String(req.staffSession._id),
        expires_at: req.staffSession.expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const sessions = await StaffSession.find({
      member_id: req.member._id,
      revoked_at: null,
      expires_at: { $gt: new Date() },
    })
      .select("created_at last_seen_at expires_at")
      .sort({ created_at: -1 })
      .lean();
    res.set("Cache-Control", "no-store");
    res.json({
      sessions: sessions.map((session) => ({
        id: String(session._id),
        created_at: session.created_at,
        last_seen_at: session.last_seen_at,
        expires_at: session.expires_at,
        current: String(session._id) === String(req.staffSession._id),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/revoke", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const session = await StaffSession.findOne({ _id: req.params.id, member_id: req.member._id, revoked_at: null });
    if (!session) return res.status(404).json({ error: "Not found" });
    await revokeSession(session, "member_revoked");
    if (String(session._id) === String(req.staffSession._id)) clearSessionCookies(res);
    await audit({
      member_id: req.member._id,
      action: "staff_session_revoked",
      entity: "staff_session",
      entity_id: String(session._id),
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/revoke-others", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    await StaffSession.updateMany(
      { member_id: req.member._id, _id: { $ne: req.staffSession._id }, revoked_at: null },
      { $set: { revoked_at: new Date(), revoked_reason: "revoked_other_sessions" } }
    );
    await audit({
      member_id: req.member._id,
      action: "staff_other_sessions_revoked",
      entity: "member",
      entity_id: String(req.member._id),
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
