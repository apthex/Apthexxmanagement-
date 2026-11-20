import type { NextRequest } from "next/server";
import { confirmSetup } from "@/lib/auth/service";
import { setupConfirmSchema } from "@/lib/validation";
import { assertSameOrigin, noStoreJson, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApi(async () => {
    assertSameOrigin(request);
    const body = setupConfirmSchema.parse(await request.json());
    const result = await confirmSetup(body.token, body.code);
    return noStoreJson({ ok: true, recoveryCodes: result.recoveryCodes });
  });
}
