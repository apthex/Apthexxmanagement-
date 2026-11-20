import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { financeReverseSchema } from "@/lib/validation";
import { reverseFinanceEntry } from "@/lib/data/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "finance.write");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = financeReverseSchema.parse(await readJson(request));
    const entry = await reverseFinanceEntry(session, parseUuid(id), input);
    return noStoreJson({ entry }, { status: 201 });
  });
}
