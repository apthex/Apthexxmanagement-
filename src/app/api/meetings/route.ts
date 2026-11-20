import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, readJson, withApi } from "@/lib/http";
import { meetingCreateSchema } from "@/lib/validation";
import { createMeeting, listMeetings } from "@/lib/data/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "meetings.read");
    const rows = await listMeetings(session, request.nextUrl.searchParams.get("q") ?? "");
    return noStoreJson({ meetings: rows, count: rows.length });
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "meetings.write");
    assertSameOrigin(request);
    const input = meetingCreateSchema.parse(await readJson(request));
    const meeting = await createMeeting(session, input);
    return noStoreJson({ meeting }, { status: 201 });
  });
}
