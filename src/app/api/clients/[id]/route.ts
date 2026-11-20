import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { clientUpdateSchema } from "@/lib/validation";
import { getClientDetail, updateClient } from "@/lib/data/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "clients.read");
    const { id } = await context.params;
    const client = await getClientDetail(session, parseUuid(id));
    return noStoreJson({ client });
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "clients.write");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = clientUpdateSchema.parse(await readJson(request));
    const client = await updateClient(session, parseUuid(id), input);
    return noStoreJson({ client });
  });
}
