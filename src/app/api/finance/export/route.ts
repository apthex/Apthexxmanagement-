import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { csvResponse, safeFilename } from "@/lib/csv";
import { withApi } from "@/lib/http";
import { exportFinanceCsv } from "@/lib/data/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "finance.read");
    const month = request.nextUrl.searchParams.get("month") ?? undefined;
    const result = await exportFinanceCsv(session, month);
    return csvResponse(safeFilename("apthex-finance", result.filename.replace("apthex-finance-", "").replace(".csv", "")), result.content);
  });
}
