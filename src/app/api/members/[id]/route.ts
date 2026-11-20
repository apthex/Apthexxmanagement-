import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { memberUpdateSchema } from "@/lib/validation";
import { updateMember } from "@/lib/data/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "members.write");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = memberUpdateSchema.parse(await readJson(request));
    const member = await updateMember(session, parseUuid(id), input);
    return noStoreJson({ member });
  });
}
