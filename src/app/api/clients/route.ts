import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, readJson, withApi } from "@/lib/http";
import { clientCreateSchema } from "@/lib/validation";
import { createClient, listClients } from "@/lib/data/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "clients.read");
    const rows = await listClients(session, request.nextUrl.searchParams.get("q") ?? "");
    return noStoreJson({ clients: rows, count: rows.length });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "clients.write");
    assertSameOrigin(request);
    const input = clientCreateSchema.parse(await readJson(request));
    const client = await createClient(session, input);
    return noStoreJson({ client }, { status: 201 });
  });
}
