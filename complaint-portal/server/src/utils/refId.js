import crypto from "crypto";

// Excludes ambiguous characters (0/O, 1/I/L) to make the reference ID easy to read aloud.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateRefId(now = new Date()) {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  let random = "";
  for (let i = 0; i < 6; i += 1) random += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return `APX-${yy}${mm}-${random}`;
}

export const REF_ID_PATTERN = /^APX-\d{4}-[2-9A-HJKMNP-Z]{6}$/;

export function isRefId(value) {
  return typeof value === "string" && REF_ID_PATTERN.test(value.trim().toUpperCase());
}
