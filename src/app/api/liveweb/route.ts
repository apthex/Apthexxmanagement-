import type { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { requirePermission, auditDenial } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { noStoreJson, withApi, notFound } from "@/lib/http";
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

    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get("tab") || "overview";
    const range = searchParams.get("range") || "today";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    // Overview metrics are accessible if member has dashboard.view OR liveweb.read
    // Detailed tabs (live, visitors, single visit) and exports require liveweb.read
    if (tab === "overview") {
      if (!can(session.member.accessLevel, "dashboard.view") && !can(session.member.accessLevel, "liveweb.read")) {
        await auditDenial(session, "dashboard.view", { path: "/api/liveweb" });
        throw notFound();
      }
    } else {
      await requirePermission(session, "liveweb.read", { path: "/api/liveweb" });
    }

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
