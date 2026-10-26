import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { noStoreJson, withApi } from "@/lib/http";
import { getDashboard } from "@/lib/data/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "dashboard.view");
    const data = await getDashboard(session);
    return noStoreJson(data);
  });
}
