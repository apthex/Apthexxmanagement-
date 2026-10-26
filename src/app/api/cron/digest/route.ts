import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { sendDailyDigest } from "@/lib/alerts";
import { cleanupRateLimits } from "@/lib/auth/service";
import { pruneExpiredSessions } from "@/lib/auth/session";
import { noStoreJson, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const given = Buffer.from(header);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function GET(request: NextRequest) {
  return withApi(async () => {
    if (!authorised(request)) {
      return noStoreJson({ error: "Not found" }, { status: 404 });
    }
    const digest = await sendDailyDigest();
    await cleanupRateLimits();
    await pruneExpiredSessions();
    return noStoreJson({ ok: true, digest: digest.summary });
  });
}
