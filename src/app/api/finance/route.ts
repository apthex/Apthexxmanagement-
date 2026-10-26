import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, readJson, withApi } from "@/lib/http";
import { financeCreateSchema, financeQuerySchema } from "@/lib/validation";
import { createFinanceEntry, listFinance } from "@/lib/data/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "finance.read");
    const sp = request.nextUrl.searchParams;
    const filters = financeQuerySchema.parse({
      month: sp.get("month") ?? undefined,
      q: sp.get("q") ?? undefined,
      direction: sp.get("direction") ?? undefined,
      category: sp.get("category") ?? undefined,
    });
    const data = await listFinance(session, filters);
    return noStoreJson(data);
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "finance.write");
    assertSameOrigin(request);
    const input = financeCreateSchema.parse(await readJson(request));
    const entry = await createFinanceEntry(session, input);
    return noStoreJson({ entry }, { status: 201 });
  });
}
