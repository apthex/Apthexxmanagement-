import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { taskCommentSchema } from "@/lib/validation";
import { addTaskComment } from "@/lib/data/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "tasks.read");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = taskCommentSchema.parse(await readJson(request));
    const comment = await addTaskComment(session, parseUuid(id), input);
    return noStoreJson({ comment }, { status: 201 });
  });
}
