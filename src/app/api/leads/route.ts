import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, readJson, withApi } from "@/lib/http";
import { leadCreateSchema, pageQuerySchema } from "@/lib/validation";
import { createLead, listLeads } from "@/lib/data/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "leads.read");
    const query = pageQuerySchema.parse({ q: request.nextUrl.searchParams.get("q") ?? undefined });
    const rows = await listLeads(session, query.q ?? "");
    return noStoreJson({ leads: rows, count: rows.length });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "leads.write");
    assertSameOrigin(request);
    const input = leadCreateSchema.parse(await readJson(request));
    const lead = await createLead(session, input);
    return noStoreJson({ lead }, { status: 201 });
  });
}
