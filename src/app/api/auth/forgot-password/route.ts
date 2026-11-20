import type { NextRequest } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/auth/service";
import { assertSameOrigin, noStoreJson, requestIp, requestUserAgent, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApi(async () => {
    assertSameOrigin(request);
    const body = forgotPasswordSchema.parse(await request.json());
    await requestPasswordReset(body.email, {
      ip: requestIp(request.headers),
      userAgent: requestUserAgent(request.headers),
    });
    // Same response whether or not the account exists.
    return noStoreJson({
      ok: true,
      message: "If that account exists, a single-use reset link has been sent. It expires in 24 hours.",
    });
  });
}
