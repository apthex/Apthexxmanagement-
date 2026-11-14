const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI_CHARS = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Store complaint text as plain text. We never render it as HTML.
 * Newlines and tabs are kept; control and bidirectional override characters are removed.
 */
export function sanitizeText(value, maxLength = 5000) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(BIDI_CHARS, "")
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 254);
}

export function normalizePhone(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[^\d+]/g, "").slice(0, 16);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function maskEmail(value) {
  if (!value || typeof value !== "string" || !value.includes("@")) return "(hidden)";
  const [local, domain] = value.split("@");
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}
