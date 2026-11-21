import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guards";
import { noStoreJson, withApi } from "@/lib/http";
import {
  getLive,
  getTotals,
  getVisits,
  getVisit,
  getPages,
  getSources,
} from "@/lib/data/liveweb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApi(async () => {
    const session = await requireApiSession(request);
    await requirePermission(session, "liveweb.read");

    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get("tab") || "overview";
    const range = searchParams.get("range") || "today";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    if (tab === "live") {
      const data = await getLive();
      return noStoreJson(data);
    }

    if (tab === "visitors") {
      const city = searchParams.get("city") || undefined;
      const source = searchParams.get("source") || undefined;
      const returning = searchParams.get("returning") === "true";
      const formSent = searchParams.get("formSent") === "true";
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(searchParams.get("limit") || "30", 10);

      const data = await getVisits({
        range,
        from,
        to,
        city,
        source,
        returning,
        formSent,
        page,
        limit,
      });
      return noStoreJson(data);
    }

    if (tab === "visit") {
      const id = searchParams.get("id");
      if (!id) {
        return noStoreJson({ error: "Missing visit id" }, { status: 400 });
      }
      const data = await getVisit(id);
      if (!data) {
        return noStoreJson({ error: "Visit not found" }, { status: 404 });
      }
      return noStoreJson(data);
    }

    if (tab === "pages") {
      const pages = await getPages(range, from, to);
      return noStoreJson({ pages });
    }

    if (tab === "sources") {
      const sources = await getSources(range, from, to);
      return noStoreJson({ sources });
    }

    // Default: Overview
    const data = await getTotals(range, from, to);
    return noStoreJson(data);
  });
}
