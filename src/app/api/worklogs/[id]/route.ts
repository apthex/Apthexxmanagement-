import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { workLogUpdateSchema } from "@/lib/validation";
import { updateWorkLog } from "@/lib/data/worklogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "worklogs.write_own");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = workLogUpdateSchema.parse(await readJson(request));
    const log = await updateWorkLog(session, parseUuid(id), input);
    return noStoreJson({ log });
  });
}
