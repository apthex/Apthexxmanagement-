import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, withApi } from "@/lib/http";
import { unassignMember } from "@/lib/data/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; assignmentId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "clients.assign");
    assertSameOrigin(request);
    const { id, assignmentId } = await context.params;
    const result = await unassignMember(session, parseUuid(id), parseUuid(assignmentId));
    return noStoreJson(result);
  });
}
