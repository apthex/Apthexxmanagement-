import type { NextRequest } from "next/server";
import { getSetupInfo } from "@/lib/auth/service";
import { badRequest, noStoreJson, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    if (!token) throw badRequest("This link is invalid or has expired.");
    const info = await getSetupInfo(token);
    if (!info) throw badRequest("This link is invalid or has expired.");
    return noStoreJson(info);
  });
}
