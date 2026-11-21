import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { csvResponse } from "@/lib/csv";
import { withApi } from "@/lib/http";
import { exportLiveWebCsv } from "@/lib/data/liveweb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "liveweb.read");
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "today";
    const view = searchParams.get("view") || "visitors";
    const result = await exportLiveWebCsv(range, view);
    return csvResponse(result.filename, result.csv);
  });
}
