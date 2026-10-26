import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { csvResponse } from "@/lib/csv";
import { notFound, withApi } from "@/lib/http";
import { livewebQuerySchema } from "@/lib/validation";
import { exportLiveWebCsv } from "@/lib/data/liveweb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "liveweb.read");
    const query = livewebQuerySchema.parse({ range: request.nextUrl.searchParams.get("range") ?? undefined });
    const result = await exportLiveWebCsv(session, query.range);
    if (!result.content) throw notFound();
    return csvResponse(result.filename, result.content);
  });
}
