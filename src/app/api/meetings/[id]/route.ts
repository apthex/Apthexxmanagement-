import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, parseUuid, readJson, withApi } from "@/lib/http";
import { meetingUpdateSchema } from "@/lib/validation";
import { updateMeeting } from "@/lib/data/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "meetings.write");
    assertSameOrigin(request);
    const { id } = await context.params;
    const input = meetingUpdateSchema.parse(await readJson(request));
    const meeting = await updateMeeting(session, parseUuid(id), input);
    return noStoreJson({ meeting });
  });
}
