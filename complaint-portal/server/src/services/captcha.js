import crypto from "crypto";
import { env, isProduction } from "../config/env.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const LOCAL_CHALLENGE_TTL_MS = 10 * 60 * 1000;

/**
 * Zero-setup fallback CAPTCHA: a signed arithmetic challenge. Works with no
 * third-party account. As soon as real Turnstile keys are configured the
 * server switches to Cloudflare automatically and these are ignored.
 */
function hmacSign(payload) {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

// One-time use guard: token hashes already redeemed in this process.
const redeemed = new Set();
function rememberRedeemed(digest) {
  redeemed.add(digest);
  if (redeemed.size > 5000) {
    const first = redeemed.values().next().value;
    redeemed.delete(first);
  }
}

export function newLocalChallenge() {
  const a = 2 + Math.floor(Math.random() * 9);
  const b = 2 + Math.floor(Math.random() * 9);
  const ops = ["+", "-", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const answer = op === "+" ? a + b : op === "-" ? Math.max(a, b) - Math.min(a, b) : a * b;
  const question = op === "-" ? `What is ${Math.max(a, b)} − ${Math.min(a, b)}?` : `What is ${a} ${op} ${b}?`;
  const payload = Buffer.from(
    JSON.stringify({ a: answer, exp: Date.now() + LOCAL_CHALLENGE_TTL_MS, n: crypto.randomUUID() })
  ).toString("base64url");
  const token = `${payload}.${hmacSign(payload)}`;
  return { question, token };
}

function verifyLocalChallenge(token, answer) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, error: "Please answer the security question" };
  }
  const [payload, signature] = token.split(".");
  const digest = hmacSign(payload);
  const expected = Buffer.from(digest);
  const provided = Buffer.from(signature || "");
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return { ok: false, error: "Security check failed — try the new question" };
  }
  if (redeemed.has(digest)) {
    return { ok: false, error: "Security check already used — try the new question" };
  }
  let data = null;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Security check failed — try the new question" };
  }
  if (!data || typeof data.a !== "number" || Date.now() > data.exp) {
    return { ok: false, error: "Security check expired — try the new question" };
  }
  const parsed = String(answer ?? "").trim().replace(/[^\d-]/g, "");
  if (parsed === "" || Number(parsed) !== data.a) {
    rememberRedeemed(digest); // wrong answer consumes the challenge too
    return { ok: false, error: "That answer is incorrect — a new question is loading" };
  }
  rememberRedeemed(digest);
  return { ok: true, local: true };
}

export function captchaPublicConfig() {
  const configured = Boolean(env.CLOUDFLARE_TURNSTILE_SITE_KEY && env.CLOUDFLARE_TURNSTILE_SECRET_KEY);
  return {
    configured,
    mode: configured ? "turnstile" : "local",
    siteKey: configured ? env.CLOUDFLARE_TURNSTILE_SITE_KEY : null,
    required: isProduction || configured,
    devBypass: !isProduction && !configured && env.CAPTCHA_DEV_BYPASS,
  };
}

/**
 * Server-side CAPTCHA verification. The development bypass requires an
 * explicit CAPTCHA_DEV_BYPASS=true and is impossible in production.
 */
export async function verifyCaptcha(token, remoteIp, answer = undefined) {
  const configured = Boolean(env.CLOUDFLARE_TURNSTILE_SECRET_KEY);
  if (!configured) {
    if (!isProduction && env.CAPTCHA_DEV_BYPASS) {
      return { ok: true, devBypass: true };
    }
    return verifyLocalChallenge(token, answer);
  }
  if (!token || typeof token !== "string") {
    return { ok: false, error: "CAPTCHA verification is required" };
  }
  try {
    const body = new URLSearchParams({
      secret: env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, error: "CAPTCHA provider unavailable" };
    const data = await response.json();
    if (data.success) return { ok: true };
    return { ok: false, error: "CAPTCHA verification failed", codes: data["error-codes"] || [] };
  } catch (error) {
    console.error("[captcha] verification error:", error.message);
    return { ok: false, error: "CAPTCHA verification could not be completed" };
  }
}
