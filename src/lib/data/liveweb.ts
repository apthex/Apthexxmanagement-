import { getMongoDb } from "@/lib/mongodb";
import { istToday, addDays } from "@/lib/dates";

export type LiveWebMetrics = {
  onSiteNow: number;
  visitors: number;
  totalVisits: number;
  pageViews: number;
  avgTimeOnSite: number;
  avgTimeOnSiteFormatted: string;
  formsSent: number;
  applyClicks: number;
};

export type VisitorDayPoint = {
  date: string;
  label: string;
  visitors: number;
  pageViews: number;
};

export type RollupItem = {
  label: string;
  count: number;
};

export type LiveVisitRow = {
  id: string;
  visitor_id: string;
  ip: string;
  location: string;
  device: string;
  onPage: string;
  cameFrom: string;
  pages: number;
  timeOnSite: number;
  timeOnSiteFormatted: string;
  lastSeen: string;
  formSent: boolean;
  applyClicked: boolean;
  applyRole?: string;
  visitCount?: number;
  isReturning?: boolean;
};

export type VisitTimelineItem = {
  time: string;
  timeStr: string;
  page: string;
  type: string;
  role?: string;
  timeOnPage: number;
  timeOnPageFormatted: string;
};

export type VisitDetail = {
  id: string;
  visitor_id: string;
  ip: string;
  location: string;
  device: string;
  source: string;
  visitCount: number;
  firstSeen: string;
  firstSeenFormatted: string;
  timeOnSiteFormatted: string;
  timeline: VisitTimelineItem[];
};

export type PageStat = {
  page: string;
  views: number;
  visitors: number;
  avgTimeOnPage: number;
  avgTimeOnPageFormatted: string;
};

export type SourceStat = {
  source: string;
  visitors: number;
  totalVisits: number;
  pagesPerVisit: number;
  avgTimeOnSite: number;
  avgTimeOnSiteFormatted: string;
  formsSent: number;
  applyClicks: number;
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
}

function getFilterDates(range: string = "today", from?: string, to?: string) {
  const now = new Date();
  let start = new Date(now);

  if (range === "today") {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    istNow.setUTCHours(0, 0, 0, 0);
    start = new Date(istNow.getTime() - istOffset);
  } else if (range === "7d") {
    start.setDate(now.getDate() - 7);
  } else if (range === "30d") {
    start.setDate(now.getDate() - 30);
  } else if (range === "custom" && from) {
    start = new Date(from);
  } else {
    start.setDate(now.getDate() - 7);
  }

  let end = now;
  if (range === "custom" && to) {
    end = new Date(to);
  }

  return { start, end };
}

async function getCollection() {
  const db = await getMongoDb("Apethexhelpportal");
  return db.collection("livevisits");
}

export async function getLive() {
  const col = await getCollection();
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

  const docs = await col
    .find({ last_seen: { $gte: fiveMinsAgo } })
    .sort({ last_seen: -1 })
    .limit(100)
    .toArray();

  const visits: LiveVisitRow[] = docs.map((v) => ({
    id: String(v.visit_id || v._id),
    visitor_id: String(v.visitor_id || ""),
    ip: String(v.ip_masked || "Unknown"),
    location: String(v.location || "Unknown"),
    device: `${v.device || "Desktop"} · ${v.browser || "Unknown"}`,
    onPage: String(v.current_page || "/"),
    cameFrom: String(v.source || "Direct"),
    pages: Number(v.pages_viewed || 1),
    timeOnSite: Number(v.time_on_site || 0),
    timeOnSiteFormatted: formatDuration(Number(v.time_on_site || 0)),
    lastSeen: new Date(v.last_seen).toISOString(),
    formSent: Boolean(v.form_sent),
    applyClicked: Boolean(v.apply_clicked),
  }));

  return {
    onSiteNow: visits.length,
    visits,
    updatedAt: new Date().toISOString(),
  };
}

export async function getTotals(range: string = "today", from?: string, to?: string) {
  const col = await getCollection();
  const { start, end } = getFilterDates(range, from, to);

  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onSiteNow = await col.countDocuments({ last_seen: { $gte: fiveMinsAgo } });

  const docs = await col.find({ first_seen: { $gte: start, $lte: end } }).toArray();

  const visitorSet = new Set<string>();
  let totalPageViews = 0;
  let totalTime = 0;
  let formsSent = 0;
  let applyClicks = 0;

  const dayMap: Record<string, { date: string; label: string; visitors: Set<string>; pageViews: number }> = {};
  const istOffset = 5.5 * 60 * 60 * 1000;

  const pageCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};

  for (const v of docs) {
    const vid = String(v.visitor_id || "");
    if (vid) visitorSet.add(vid);

    const pages = Number(v.pages_viewed || 1);
    totalPageViews += pages;
    totalTime += Number(v.time_on_site || 0);

    if (v.form_sent) formsSent += 1;
    if (v.apply_clicked) applyClicks += 1;

    // Daily buckets
    const istDate = new Date(new Date(v.first_seen).getTime() + istOffset);
    const dayKey = istDate.toISOString().slice(0, 10);
    if (!dayMap[dayKey]) {
      dayMap[dayKey] = {
        date: dayKey,
        label: istDate.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" }),
        visitors: new Set(),
        pageViews: 0,
      };
    }
    if (vid) dayMap[dayKey].visitors.add(vid);
    dayMap[dayKey].pageViews += pages;

    // Timeline page counts
    const timeline = Array.isArray(v.timeline) ? v.timeline : [];
    for (const t of timeline) {
      if (t.type === "pageview" && t.page) {
        pageCounts[t.page] = (pageCounts[t.page] || 0) + 1;
      }
    }

    // Source counts
    const src = String(v.source || "Direct");
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;

    // City counts
    const city = v.city || (v.location && v.location !== "Unknown" ? String(v.location).split(",")[0] : null);
    if (city) {
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
  }

  const avgTime = docs.length ? Math.round(totalTime / docs.length) : 0;

  const visitorsPerDay: VisitorDayPoint[] = Object.keys(dayMap)
    .sort()
    .map((k) => ({
      date: dayMap[k].date,
      label: dayMap[k].label,
      visitors: dayMap[k].visitors.size,
      pageViews: dayMap[k].pageViews,
    }));

  const topPages: RollupItem[] = Object.entries(pageCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topSources: RollupItem[] = Object.entries(sourceCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topCities: RollupItem[] = Object.entries(cityCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    onSiteNow,
    metrics: {
      onSiteNow,
      visitors: visitorSet.size,
      totalVisits: docs.length,
      pageViews: totalPageViews,
      avgTimeOnSite: avgTime,
      avgTimeOnSiteFormatted: formatDuration(avgTime),
      formsSent,
      applyClicks,
    },
    visitorsPerDay,
    topPages,
    topSources,
    topCities,
  };
}

export async function getVisits(params: {
  range?: string;
  from?: string;
  to?: string;
  city?: string;
  source?: string;
  returning?: boolean;
  formSent?: boolean;
  page?: number;
  limit?: number;
}) {
  const col = await getCollection();
  const { start, end } = getFilterDates(params.range, params.from, params.to);

  const filter: Record<string, unknown> = {
    first_seen: { $gte: start, $lte: end },
  };

  if (params.city) {
    filter.city = new RegExp(`^${params.city}$`, "i");
  }
  if (params.source) {
    filter.source = params.source;
  }
  if (params.returning) {
    filter.visit_count = { $gt: 1 };
  }
  if (params.formSent) {
    filter.form_sent = true;
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 30));
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort({ first_seen: -1 }).skip(skip).limit(limit).toArray(),
  ]);

  const visits: LiveVisitRow[] = docs.map((v) => ({
    id: String(v.visit_id || v._id),
    visitor_id: String(v.visitor_id || ""),
    ip: String(v.ip_masked || "Unknown"),
    location: String(v.location || "Unknown"),
    device: `${v.device || "Desktop"} · ${v.browser || "Unknown"}`,
    onPage: String(v.current_page || "/"),
    cameFrom: String(v.source || "Direct"),
    pages: Number(v.pages_viewed || 1),
    timeOnSite: Number(v.time_on_site || 0),
    timeOnSiteFormatted: formatDuration(Number(v.time_on_site || 0)),
    lastSeen: new Date(v.last_seen).toISOString(),
    formSent: Boolean(v.form_sent),
    applyClicked: Boolean(v.apply_clicked),
    applyRole: String(v.apply_role || ""),
    visitCount: Number(v.visit_count || 1),
    isReturning: Number(v.visit_count || 1) > 1,
  }));

  return {
    visits,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  };
}

export async function getVisit(id: string): Promise<VisitDetail | null> {
  const col = await getCollection();
  const v = await col.findOne({ visit_id: id });
  if (!v) return null;

  const istOffset = 5.5 * 60 * 60 * 1000;
  const istFirstSeen = new Date(new Date(v.first_seen).getTime() + istOffset);

  const timelineRaw = Array.isArray(v.timeline) ? v.timeline : [];
  const timeline: VisitTimelineItem[] = timelineRaw.map((item) => {
    const itemIst = new Date(new Date(item.time).getTime() + istOffset);
    const timeStr = itemIst.toISOString().substring(11, 16);
    return {
      time: new Date(item.time).toISOString(),
      timeStr,
      page: String(item.page || "/"),
      type: String(item.type || "pageview"),
      role: item.meta?.role || "",
      timeOnPage: Number(item.time_on_page || 0),
      timeOnPageFormatted: formatDuration(Number(item.time_on_page || 0)),
    };
  });

  return {
    id: String(v.visit_id),
    visitor_id: String(v.visitor_id),
    ip: String(v.ip_masked || "Unknown"),
    location: String(v.location || "Unknown"),
    device: `${v.device || "Desktop"} · ${v.browser || "Unknown"}`,
    source: String(v.source || "Direct"),
    visitCount: Number(v.visit_count || 1),
    firstSeen: new Date(v.first_seen).toISOString(),
    firstSeenFormatted: istFirstSeen.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }),
    timeOnSiteFormatted: formatDuration(Number(v.time_on_site || 0)),
    timeline,
  };
}

export async function getPages(range: string = "today", from?: string, to?: string): Promise<PageStat[]> {
  const col = await getCollection();
  const { start, end } = getFilterDates(range, from, to);
  const docs = await col.find({ first_seen: { $gte: start, $lte: end } }).toArray();

  const pageStats: Record<string, { page: string; views: number; visitors: Set<string>; duration: number; count: number }> = {};

  for (const v of docs) {
    const vid = String(v.visitor_id || "");
    const timeline = Array.isArray(v.timeline) ? v.timeline : [];
    for (const item of timeline) {
      if (item.type === "pageview" && item.page) {
        if (!pageStats[item.page]) {
          pageStats[item.page] = { page: item.page, views: 0, visitors: new Set(), duration: 0, count: 0 };
        }
        pageStats[item.page].views += 1;
        if (vid) pageStats[item.page].visitors.add(vid);
        if (Number(item.time_on_page) > 0) {
          pageStats[item.page].duration += Number(item.time_on_page);
          pageStats[item.page].count += 1;
        }
      }
    }
  }

  return Object.values(pageStats)
    .map((p) => {
      const avgSecs = p.count > 0 ? Math.round(p.duration / p.count) : 0;
      return {
        page: p.page,
        views: p.views,
        visitors: p.visitors.size,
        avgTimeOnPage: avgSecs,
        avgTimeOnPageFormatted: formatDuration(avgSecs),
      };
    })
    .sort((a, b) => b.views - a.views);
}

export async function getSources(range: string = "today", from?: string, to?: string): Promise<SourceStat[]> {
  const col = await getCollection();
  const { start, end } = getFilterDates(range, from, to);
  const docs = await col.find({ first_seen: { $gte: start, $lte: end } }).toArray();

  const sourceStats: Record<string, { source: string; visitors: Set<string>; visits: number; pages: number; time: number; forms: number; applies: number }> = {};
  const defaultSources = ["LinkedIn", "Google", "Instagram", "Tally", "X", "Direct"];
  defaultSources.forEach((src) => {
    sourceStats[src] = { source: src, visitors: new Set(), visits: 0, pages: 0, time: 0, forms: 0, applies: 0 };
  });

  for (const v of docs) {
    const src = String(v.source || "Direct");
    if (!sourceStats[src]) {
      sourceStats[src] = { source: src, visitors: new Set(), visits: 0, pages: 0, time: 0, forms: 0, applies: 0 };
    }
    const vid = String(v.visitor_id || "");
    if (vid) sourceStats[src].visitors.add(vid);
    sourceStats[src].visits += 1;
    sourceStats[src].pages += Number(v.pages_viewed || 1);
    sourceStats[src].time += Number(v.time_on_site || 0);
    if (v.form_sent) sourceStats[src].forms += 1;
    if (v.apply_clicked) sourceStats[src].applies += 1;
  }

  return Object.values(sourceStats)
    .map((s) => {
      const visitorCount = s.visitors.size;
      const pagesPerVisit = s.visits > 0 ? parseFloat((s.pages / s.visits).toFixed(1)) : 0;
      const avgTime = s.visits > 0 ? Math.round(s.time / s.visits) : 0;
      return {
        source: s.source,
        visitors: visitorCount,
        totalVisits: s.visits,
        pagesPerVisit,
        avgTimeOnSite: avgTime,
        avgTimeOnSiteFormatted: formatDuration(avgTime),
        formsSent: s.forms,
        applyClicks: s.applies,
      };
    })
    .sort((a, b) => b.visitors - a.visitors);
}

function sanitizeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function exportLiveWebCsv(range: string = "today", view: string = "visitors") {
  const dateStr = new Date().toISOString().slice(0, 10);

  if (view === "pages") {
    const pages = await getPages(range);
    const header = ["Page", "Views", "Unique Visitors", "Avg Time on Page (seconds)"];
    const rows = pages.map((p) => [
      sanitizeCsv(p.page),
      sanitizeCsv(p.views),
      sanitizeCsv(p.visitors),
      sanitizeCsv(p.avgTimeOnPage),
    ]);
    return {
      filename: `liveweb-pages-${dateStr}.csv`,
      csv: [header.join(","), ...rows.map((r) => r.join(","))].join("\n"),
    };
  }

  if (view === "sources") {
    const sources = await getSources(range);
    const header = ["Source", "Visitors", "Pages / Visit", "Avg Time on Site (seconds)", "Forms Sent", "Apply Clicks"];
    const rows = sources.map((s) => [
      sanitizeCsv(s.source),
      sanitizeCsv(s.visitors),
      sanitizeCsv(s.pagesPerVisit),
      sanitizeCsv(s.avgTimeOnSite),
      sanitizeCsv(s.formsSent),
      sanitizeCsv(s.applyClicks),
    ]);
    return {
      filename: `liveweb-sources-${dateStr}.csv`,
      csv: [header.join(","), ...rows.map((r) => r.join(","))].join("\n"),
    };
  }

  // Default visitors export
  const { visits } = await getVisits({ range, limit: 1000 });
  const header = [
    "Visit ID",
    "Visitor ID",
    "IP (Masked)",
    "Location",
    "Device",
    "Came From",
    "Current Page",
    "Pages Viewed",
    "Time on Site (seconds)",
    "Form Sent",
    "Apply Clicked",
    "Visit Count",
    "Last Seen",
  ];
  const rows = visits.map((v) => [
    sanitizeCsv(v.id),
    sanitizeCsv(v.visitor_id),
    sanitizeCsv(v.ip),
    sanitizeCsv(v.location),
    sanitizeCsv(v.device),
    sanitizeCsv(v.cameFrom),
    sanitizeCsv(v.onPage),
    sanitizeCsv(v.pages),
    sanitizeCsv(v.timeOnSite),
    sanitizeCsv(v.formSent ? "Yes" : "No"),
    sanitizeCsv(v.applyClicked ? "Yes" : "No"),
    sanitizeCsv(v.visitCount),
    sanitizeCsv(v.lastSeen),
  ]);

  return {
    filename: `liveweb-visitors-${dateStr}.csv`,
    csv: [header.join(","), ...rows.map((r) => r.join(","))].join("\n"),
  };
}
