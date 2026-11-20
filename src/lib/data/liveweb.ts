import { env } from "@/lib/env";
import { addDays, istToday } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import type { AuthSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS, writeAuditStandalone } from "@/lib/audit";
import { alertExport } from "@/lib/alerts";

type VisitorRow = {
  ip: string;
  location: string;
  device: string;
  browser: string;
  page: string;
  source: string;
  timeOnSite: number;
  lastAction: string | null;
};

type MatomoRow = Record<string, unknown>;

type Rollup = { label: string; visits: number };
export type LiveWebResult =
  | { available: false; reason: "not_configured" | "unavailable"; site: "apthex.com"; generatedAt: string }
  | {
      available: true;
      site: "apthex.com";
      generatedAt: string;
      range: string;
      liveNow: number;
      todayVisits: number;
      totalVisits: number;
      totalViews: number;
      avgTimeOnSite: number;
      visitors: VisitorRow[];
      topPages: Rollup[];
      topSources: Rollup[];
      topCountries: Rollup[];
      topDevices: Rollup[];
      topBrowsers: Rollup[];
    };

type CacheEntry = { at: number; data: LiveWebResult };
const globalCache = globalThis as unknown as { __apthexLiveWeb?: Map<string, CacheEntry> };
const cache = (globalCache.__apthexLiveWeb ??= new Map());

function rangeDates(range: "live" | "today" | "7d" | "30d"): { start: string; end: string; period: "day" | "range"; date: string } {
  const today = istToday();
  if (range === "today" || range === "live") return { start: today, end: today, period: "day", date: today };
  const days = range === "7d" ? 7 : 30;
  const start = addDays(today, -(days - 1));
  return { start, end: today, period: "range", date: `${start},${today}` };
}

function configured(): boolean {
  return Boolean(env.matomoUrl && env.matomoToken && env.matomoSiteId);
}

async function matomo(method: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${env.matomoUrl}/index.php`);
  url.searchParams.set("module", "API");
  url.searchParams.set("method", method);
  url.searchParams.set("idSite", env.matomoSiteId);
  url.searchParams.set("format", "json");
  url.searchParams.set("token_auth", env.matomoToken);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Matomo HTTP ${response.status}`);
  const payload = (await response.json()) as MatomoRow & { result?: string; message?: string };
  if (payload.result === "error") throw new Error("Matomo API error");
  return payload;
}

function asRows(value: unknown): MatomoRow[] {
  return Array.isArray(value) ? (value as MatomoRow[]) : [];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function pagePath(url: string): string {
  if (!url) return "/";
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

function rollup(value: unknown, limit = 10): Rollup[] {
  return asRows(value)
    .map((row) => ({
      label: str(row.label, str(row.name, "Unknown")),
      visits: num(row.nb_visits ?? row.nb_hits ?? row.hits),
    }))
    .filter((row) => row.label && row.label !== "Unknown")
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit);
}

async function fetchLiveWeb(range: "live" | "today" | "7d" | "30d"): Promise<LiveWebResult> {
  const generatedAt = new Date().toISOString();
  if (!configured()) {
    return { available: false, reason: "not_configured", site: "apthex.com", generatedAt };
  }

  try {
    const dates = rangeDates(range);
    const [summary, todaySummary, visitsRaw, pages, sources, countries, devices, browsers, liveCounters] = await Promise.all([
      matomo("VisitsSummary.get", { period: dates.period, date: dates.date }),
      matomo("VisitsSummary.get", { period: "day", date: istToday() }),
      matomo("Live.getLastVisitsDetails", {
        period: dates.period,
        date: dates.date,
        filter_limit: "500",
        filter_sort_order: "desc",
      }),
      matomo("Actions.getPageUrls", { period: dates.period, date: dates.date, flat: "1", filter_limit: "10" }),
      matomo("Referrers.getAll", { period: dates.period, date: dates.date, filter_limit: "10" }),
      matomo("UserCountry.getCountry", { period: dates.period, date: dates.date, filter_limit: "10" }),
      matomo("DevicesDetection.getType", { period: dates.period, date: dates.date, filter_limit: "10" }),
      matomo("DevicesDetection.getBrowserFamilies", { period: dates.period, date: dates.date, filter_limit: "10" }),
      matomo("Live.getCounters", { lastMinutes: "5" }),
    ]);

    const visitors: VisitorRow[] = asRows(visitsRaw).map((visit) => {
      const city = str(visit.city);
      const country = str(visit.country);
      const location = [city, str(visit.countryCode)].filter(Boolean).join(", ") || country || "Unknown";
      return {
        ip: str(visit.visitIp, "unknown"),
        location,
        device: str(visit.deviceType, "Unknown"),
        browser: [str(visit.browserName), str(visit.browserVersion)].filter(Boolean).join(" ") || "Unknown",
        page: pagePath(str(visit.entryPageUrl)),
        source: str(visit.referrerName, str(visit.referrerType, "Direct")),
        timeOnSite: num(visit.visitDuration),
        lastAction: str(visit.lastActionDateTime) || null,
      };
    });

    const counters = Array.isArray(liveCounters) ? (liveCounters[0] as MatomoRow | undefined) : (liveCounters as MatomoRow);
    const summaryRow = summary as MatomoRow;
    const todayRow = todaySummary as MatomoRow;

    return {
      available: true,
      site: "apthex.com",
      generatedAt,
      range,
      liveNow: num(counters?.visits),
      todayVisits: num(todayRow.nb_visits),
      totalVisits: num(summaryRow.nb_visits),
      totalViews: num(summaryRow.nb_actions),
      avgTimeOnSite: num(summaryRow.avg_time_on_site),
      visitors,
      topPages: rollup(pages),
      topSources: rollup(sources),
      topCountries: rollup(countries),
      topDevices: rollup(devices),
      topBrowsers: rollup(browsers),
    };
  } catch (error) {
    console.error("[liveweb] Matomo request failed", error instanceof Error ? error.message : error);
    return { available: false, reason: "unavailable", site: "apthex.com", generatedAt };
  }
}

export async function getLiveWeb(range: "live" | "today" | "7d" | "30d") {
  const key = `${range}:${env.matomoUrl}:${env.matomoSiteId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.data;
  const data = await fetchLiveWeb(range);
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function logLiveWebRead(session: AuthSession, range: string) {
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.livewebRead,
    entityType: "liveweb",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { range },
  });
}

export async function exportLiveWebCsv(session: AuthSession, range: "live" | "today" | "7d" | "30d") {
  const data = await getLiveWeb(range);
  if (!data.available) {
    return { content: null, rowCount: 0, filename: "apthex-liveweb-unavailable.csv" };
  }
  const content = toCsv(
    ["ip", "location", "device", "browser", "landing_page", "source", "time_on_site_seconds", "last_action"],
    data.visitors.map((visitor: VisitorRow) => [
      visitor.ip,
      visitor.location,
      visitor.device,
      visitor.browser,
      visitor.page,
      visitor.source,
      visitor.timeOnSite,
      visitor.lastAction,
    ]),
  );
  await writeAuditStandalone({
    memberId: session.member.id,
    action: AUDIT_ACTIONS.export,
    entityType: "liveweb",
    outcome: "allowed",
    ip: session.ip,
    userAgent: session.userAgent,
    detail: { range, rows: data.visitors.length, format: "csv" },
  });
  void alertExport(session.member.name, `LiveWeb ${range}`, data.visitors.length, session.ip);
  return { content, rowCount: data.visitors.length, filename: `apthex-liveweb-${range}-${istToday()}.csv` };
}
