import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { workLogRateSchema } from "@/lib/validation";
import { rateWorkLog } from "@/lib/data/worklogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "worklogs.rate");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = workLogRateSchema.parse(await readJson(request));
    const log = await rateWorkLog(session, parseUuid(id), input);
    return noStoreJson({ log });
  });
}
