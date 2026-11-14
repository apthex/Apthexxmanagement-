import StaffSession from "../models/StaffSession.js";
import Member from "../models/Member.js";
import { env, isProduction, allowedOrigins } from "../config/env.js";
import { randomToken, sha256, timingSafeEqual } from "../utils/hash.js";

export const SESSION_COOKIE = "apthex_session";
export const CSRF_COOKIE = "apthex_csrf";

function sessionMaxAgeMs() {
  return env.SESSION_TTL_HOURS * 60 * 60 * 1000;
}

function baseCookieOptions(httpOnly) {
  return {
    httpOnly,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: sessionMaxAgeMs(),
  };
}

export async function createStaffSession(member, res) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const now = new Date();
  await StaffSession.create({
    token_hash: sha256(token),
    csrf_hash: sha256(csrfToken),
    member_id: member._id,
    created_at: now,
    last_seen_at: now,
    expires_at: new Date(now.getTime() + sessionMaxAgeMs()),
  });
  res.cookie(SESSION_COOKIE, token, baseCookieOptions(true));
  res.cookie(CSRF_COOKIE, csrfToken, baseCookieOptions(false));
  return { csrfToken };
}

export function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/", sameSite: "lax", secure: isProduction });
  res.clearCookie(CSRF_COOKIE, { path: "/", sameSite: "lax", secure: isProduction });
}

export function publicMember(member) {
  return {
    id: String(member._id),
    name: member.name,
    email: member.email,
    role: member.role,
    totp_enabled: Boolean(member.totp_enabled),
  };
}

export async function loadMemberFromSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const session = await StaffSession.findOne({
    token_hash: sha256(token),
    revoked_at: null,
    expires_at: { $gt: new Date() },
  });
  if (!session) return null;

  const member = await Member.findById(session.member_id);
  if (!member || member.status !== "active") return null;

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (!session.last_seen_at || session.last_seen_at < fiveMinutesAgo) {
    StaffSession.updateOne({ _id: session._id }, { $set: { last_seen_at: new Date() } }).catch(() => {});
    session.last_seen_at = new Date();
  }

  return { member, session };
}

export async function requireAuth(req, res, next) {
  try {
    const loaded = await loadMemberFromSession(req);
    if (!loaded) {
      clearSessionCookies(res);
      return res.status(401).json({ error: "Authentication required" });
    }

    req.member = loaded.member;
    req.staffSession = loaded.session;
    next();
  } catch (error) {
    next(error);
  }
}

export async function ensureCsrfToken(req, res) {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (existing && req.staffSession && timingSafeEqual(sha256(existing), req.staffSession.csrf_hash)) {
    return existing;
  }
  const token = randomToken(24);
  if (req.staffSession) {
    req.staffSession.csrf_hash = sha256(token);
    await req.staffSession.save();
  }
  res.cookie(CSRF_COOKIE, token, baseCookieOptions(false));
  return token;
}

function requestOrigin(req) {
  const origin = req.get("origin");
  if (origin) return origin;
  const referer = req.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function requireTrustedOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = requestOrigin(req);
  if (!origin) {
    if (env.REQUIRE_ORIGIN || isProduction) {
      return res.status(403).json({ error: "Request origin could not be verified" });
    }
    return next();
  }
  const allowed = allowedOrigins();
  if (!allowed.includes(origin)) {
    return res.status(403).json({ error: "Request origin is not allowed" });
  }
  next();
}

export function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const header = req.get("x-csrf-token");
  const cookie = req.cookies?.[CSRF_COOKIE];
  if (!header || !cookie || !req.staffSession?.csrf_hash) {
    return res.status(403).json({ error: "CSRF verification failed" });
  }
  if (!timingSafeEqual(sha256(header), req.staffSession.csrf_hash) || !timingSafeEqual(header, cookie)) {
    return res.status(403).json({ error: "CSRF verification failed" });
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.member || !roles.includes(req.member.role)) {
      // Deliberately 404 so unauthorised staff cannot confirm the existence of
      // records or administrative endpoints.
      return res.status(404).json({ error: "Not found" });
    }
    next();
  };
}

export async function revokeSession(session, reason = "revoked") {
  if (!session || session.revoked_at) return;
  session.revoked_at = new Date();
  session.revoked_reason = reason;
  await session.save();
}

export async function revokeAllSessionsForMember(memberId, reason = "revoked") {
  await StaffSession.updateMany(
    { member_id: memberId, revoked_at: null },
    { $set: { revoked_at: new Date(), revoked_reason: reason } }
  );
}
