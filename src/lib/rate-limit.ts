import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
};

/**
 * Database-backed fixed-window counter. The key must include the subject, e.g.
 * "login:ip:49.36.1.2" or "login:account:someone@example.com".
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const resetAt = new Date(windowStartMs + windowMs);

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: {
        count: sql`${rateLimits.count} + 1`,
        updatedAt: now,
      },
    })
    .returning({ count: rateLimits.count });

  const count = row?.count ?? 1;
  return { allowed: count <= limit, count, limit, resetAt };
}

/** Read-only view of a counter (used by tests and alert thresholds). */
export async function readRateLimit(key: string, windowMs: number, now = new Date()): Promise<number> {
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const rows = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), eq(rateLimits.windowStart, new Date(windowStartMs))))
    .limit(1);
  return rows[0]?.count ?? 0;
}
