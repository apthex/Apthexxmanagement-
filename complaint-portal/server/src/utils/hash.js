import crypto from "crypto";
import { env } from "../config/env.js";

function hmac(value, label) {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(`${label}:${value}`).digest("hex");
}

export function hashIp(raw) {
  if (!raw) return null;
  return `sha256:${hmac(String(raw), "ip")}`;
}

export function hashDeviceId(raw) {
  if (!raw) return null;
  return `sha256:${hmac(String(raw), "device")}`;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
