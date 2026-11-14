import RateLimit from "../models/RateLimit.js";

/**
 * Atomic fixed-window rate limiter backed by MongoDB.
 * Returns { allowed, count, retryAfterSeconds }.
 */
export async function checkRateLimit(key, windowMs, max) {
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs);

  const doc = await RateLimit.findOneAndUpdate(
    { key, window_start: windowStart },
    {
      $inc: { count: 1 },
      $setOnInsert: { expires_at: expiresAt },
    },
    { upsert: true, returnDocument: "after" }
  );

  return {
    allowed: doc.count <= max,
    count: doc.count,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
  };
}

export async function rateLimit(key, windowMs, max) {
  const result = await checkRateLimit(key, windowMs, max);
  return result.allowed;
}
