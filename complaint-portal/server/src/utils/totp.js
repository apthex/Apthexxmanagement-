import crypto from "crypto";
import speakeasy from "speakeasy";
import { env } from "../config/env.js";

const ALG = "aes-256-gcm";

function key() {
  return crypto.createHash("sha256").update(env.TOTP_ENCRYPTION_KEY).digest();
}

export function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload) {
  if (!payload) return null;
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !tagHex || !encryptedHex) return null;
  const decipher = crypto.createDecipheriv(ALG, key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
}

export function newSecret(email) {
  const generated = speakeasy.generateSecret({ name: `APTHEX Complaint Portal (${email})`, length: 20 });
  return { secret: generated.base32, otpauthUrl: generated.otpauth_url };
}

export function verifyToken(secret, token) {
  if (!secret || !token) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(token).replace(/\s/g, ""),
    window: 1,
  });
}
