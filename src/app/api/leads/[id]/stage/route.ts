import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { leadStageSchema } from "@/lib/validation";
import { moveLeadStage } from "@/lib/data/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "leads.write");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = leadStageSchema.parse(await readJson(request));
    const result = await moveLeadStage(session, parseUuid(id), input);
    return noStoreJson(result);
  });
}
