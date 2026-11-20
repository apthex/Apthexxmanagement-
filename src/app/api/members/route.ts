import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, readJson, withApi } from "@/lib/http";
import { memberCreateSchema } from "@/lib/validation";
import { createMember, listMembers } from "@/lib/data/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "members.read");
    const rows = await listMembers(session);
    return noStoreJson({ members: rows, count: rows.length });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "members.write");
    assertSameOrigin(request);
    const input = memberCreateSchema.parse(await readJson(request));
    const result = await createMember(session, input);
    return noStoreJson(result, { status: 201 });
  });
}
