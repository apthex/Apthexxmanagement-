export const INSTITUTE_KEY = "apthex_institute";
export const CATEGORY_KEY = "apthex_category";
export const URGENT_KEY = "apthex_urgent";
export const REF_KEY = "apthex_ref";
export const ACK_KEY = "apthex_ack_email";

function safeSession() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveInstitute(institute) {
  const storage = safeSession();
  if (!storage) return;
  storage.setItem(INSTITUTE_KEY, JSON.stringify({ code: institute.code, name: institute.name, type: institute.type }));
}

export function getInstitute() {
  const storage = safeSession();
  if (!storage) return null;
  try {
    const raw = storage.getItem(INSTITUTE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCategory(category, urgent = false) {
  const storage = safeSession();
  if (!storage) return;
  storage.setItem(CATEGORY_KEY, category);
  storage.setItem(URGENT_KEY, urgent ? "1" : "0");
}

export function getCategory() {
  const storage = safeSession();
  if (!storage) return { category: null, urgent: false };
  return {
    category: storage.getItem(CATEGORY_KEY),
    urgent: storage.getItem(URGENT_KEY) === "1",
  };
}

export function saveConfirmation({ refId, acknowledgementEmail }) {
  const storage = safeSession();
  if (!storage) return;
  storage.setItem(REF_KEY, refId);
  storage.setItem(ACK_KEY, acknowledgementEmail ? "1" : "0");
  storage.removeItem(CATEGORY_KEY);
  storage.removeItem(URGENT_KEY);
}

export function getConfirmation() {
  const storage = safeSession();
  if (!storage) return { refId: "", acknowledgementEmail: false };
  return {
    refId: storage.getItem(REF_KEY) || "",
    acknowledgementEmail: storage.getItem(ACK_KEY) === "1",
  };
}

export function getReference() {
  const storage = safeSession();
  return storage?.getItem(REF_KEY) || "";
}

export function clearDraft() {
  const storage = safeSession();
  if (!storage) return;
  storage.removeItem(INSTITUTE_KEY);
  storage.removeItem(CATEGORY_KEY);
  storage.removeItem(URGENT_KEY);
}

/**
 * A random, non-identifying device identifier used only for abuse-rate limits.
 * It is stored locally, never displayed and hash-salted on the server.
 */
export function getDeviceId() {
  if (typeof window === "undefined") return "";
  const key = "apthex_device";
  try {
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "";
  }
}
