import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { assertSameOrigin, noStoreJson, readJson, withApi } from "@/lib/http";
import { workLogCreateSchema, workLogQuerySchema } from "@/lib/validation";
import { createWorkLog, listWorkLogs } from "@/lib/data/worklogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "worklogs.write_own");
    const query = workLogQuerySchema.parse({
      week: request.nextUrl.searchParams.get("week") ?? undefined,
    });
    const data = await listWorkLogs(session, query.week);
    return noStoreJson(data);
  });
}

export async function POST(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "worklogs.write_own");
    assertSameOrigin(request);
    const input = workLogCreateSchema.parse(await readJson(request));
    const log = await createWorkLog(session, input);
    return noStoreJson({ log }, { status: 201 });
  });
}
