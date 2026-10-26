import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { csvResponse } from "@/lib/csv";
import { noStoreJson, withApi } from "@/lib/http";
import { livewebQuerySchema } from "@/lib/validation";
import { exportLiveWebCsv, getLiveWeb, logLiveWebRead } from "@/lib/data/liveweb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "liveweb.read");
    const query = livewebQuerySchema.parse({ range: request.nextUrl.searchParams.get("range") ?? undefined });
    const data = await getLiveWeb(query.range);
    await logLiveWebRead(session, query.range);
    return noStoreJson(data);
  });
}
