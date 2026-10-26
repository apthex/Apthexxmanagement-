import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { taskUpdateSchema } from "@/lib/validation";
import { getTaskDetail, updateTask } from "@/lib/data/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "tasks.read");
    const { id } = await context.params;
    const task = await getTaskDetail(session, parseUuid(id));
    return noStoreJson({ task });
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "tasks.read");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = taskUpdateSchema.parse(await readJson(request));
    const task = await updateTask(session, parseUuid(id), input);
    return noStoreJson({ task });
  });
}
