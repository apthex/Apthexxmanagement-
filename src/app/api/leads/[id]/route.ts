import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { leadDeleteSchema, leadUpdateSchema } from "@/lib/validation";
import { deleteLead, getLead, updateLead } from "@/lib/data/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "leads.read");
    const { id } = await context.params;
    const lead = await getLead(session, parseUuid(id));
    return noStoreJson({ lead });
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "leads.write");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = leadUpdateSchema.parse(await readJson(request));
    const lead = await updateLead(session, parseUuid(id), input);
    return noStoreJson({ lead });
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "leads.delete");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = leadDeleteSchema.parse(await readJson(request));
    const result = await deleteLead(session, parseUuid(id), input.confirmName);
    return noStoreJson(result);
  });
}
