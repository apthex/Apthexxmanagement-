import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { assignmentSchema } from "@/lib/validation";
import { assignMember } from "@/lib/data/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "clients.assign");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = assignmentSchema.parse(await readJson(request));
    const assignment = await assignMember(session, parseUuid(id), input);
    return noStoreJson({ assignment }, { status: 201 });
  });
}
