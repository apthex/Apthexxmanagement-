import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { resetTotpSchema } from "@/lib/validation";
import { resetMemberTwoFactor } from "@/lib/data/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "members.write");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = resetTotpSchema.parse(await readJson(request));
    const result = await resetMemberTwoFactor(session, parseUuid(id), input.confirmName);
    return noStoreJson(result);
  });
}
