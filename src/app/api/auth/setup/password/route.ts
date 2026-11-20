import type { NextRequest } from "next/server";
import { setSetupPassword } from "@/lib/auth/service";
import { setupPasswordSchema } from "@/lib/validation";
import { assertSameOrigin, noStoreJson, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApi(async () => {
    assertSameOrigin(request);
    const body = setupPasswordSchema.parse(await request.json());
    const result = await setSetupPassword(body.token, body.password);
    return noStoreJson(result);
  });
}
