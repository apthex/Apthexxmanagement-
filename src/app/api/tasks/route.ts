import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, readJson, withApi } from "@/lib/http";
import { taskCreateSchema, taskQuerySchema } from "@/lib/validation";
import { createTask, listTasks } from "@/lib/data/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "tasks.read");
    const sp = request.nextUrl.searchParams;
    const filters = taskQuerySchema.parse({
      q: sp.get("q") ?? undefined,
      status: sp.get("status") ?? undefined,
      assigneeMemberId: sp.get("assigneeMemberId") ?? undefined,
      due: sp.get("due") ?? undefined,
    });
    const rows = await listTasks(session, filters);
    return noStoreJson({ tasks: rows, count: rows.length });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "tasks.create");
    assertSameOrigin(request);
    const input = taskCreateSchema.parse(await readJson(request));
    const task = await createTask(session, input);
    return noStoreJson({ task }, { status: 201 });
  });
}
