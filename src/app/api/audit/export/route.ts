import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { csvResponse } from "@/lib/csv";
import { withApi } from "@/lib/http";
import { auditQuerySchema } from "@/lib/validation";
import { exportAuditCsv } from "@/lib/data/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "audit.read");
    const sp = request.nextUrl.searchParams;
    const filters = auditQuerySchema.parse({
      memberId: sp.get("memberId") ?? undefined,
      action: sp.get("action") ?? undefined,
      outcome: sp.get("outcome") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      q: sp.get("q") ?? undefined,
    });
    const result = await exportAuditCsv(session, filters);
    return csvResponse(result.filename, result.content);
  });
}
