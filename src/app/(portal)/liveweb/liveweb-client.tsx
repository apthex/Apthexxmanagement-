"use client";

import * as React from "react";
import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck2,
  Filter,
  Globe,
  Laptop,
  Layers,
  MapPin,
  MousePointerClick,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type ActiveTab = "overview" | "live" | "visitors" | "pages" | "sources";
type DateRange = "today" | "7d" | "30d" | "custom";

export function LiveWebClient() {
  const [tab, setTab] = React.useState<ActiveTab>("overview");
  const [range, setRange] = React.useState<DateRange>("today");
  const [customFrom, setCustomFrom] = React.useState<string>("");
  const [customTo, setCustomTo] = React.useState<string>("");

  // Live screen state
  const [liveData, setLiveData] = React.useState<any>(null);
  const [liveLoading, setLiveLoading] = React.useState<boolean>(false);
  const [lastLiveFetch, setLastLiveFetch] = React.useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = React.useState<number>(0);

  // Overview state
  const [overviewData, setOverviewData] = React.useState<any>(null);
  const [overviewLoading, setOverviewLoading] = React.useState<boolean>(false);

  // Visitors state
  const [visitorsData, setVisitorsData] = React.useState<any>(null);
  const [visitorsLoading, setVisitorsLoading] = React.useState<boolean>(false);
  const [filterCity, setFilterCity] = React.useState<string>("");
  const [filterSource, setFilterSource] = React.useState<string>("");
  const [filterReturning, setFilterReturning] = React.useState<boolean>(false);
  const [filterFormSent, setFilterFormSent] = React.useState<boolean>(false);
  const [page, setPage] = React.useState<number>(1);

  // Single visit detail state
  const [selectedVisitId, setSelectedVisitId] = React.useState<string | null>(null);
  const [visitDetail, setVisitDetail] = React.useState<any>(null);
  const [visitLoading, setVisitLoading] = React.useState<boolean>(false);

  // Pages state
  const [pagesData, setPagesData] = React.useState<any>(null);
  const [pagesLoading, setPagesLoading] = React.useState<boolean>(false);

  // Sources state
  const [sourcesData, setSourcesData] = React.useState<any>(null);
  const [sourcesLoading, setSourcesLoading] = React.useState<boolean>(false);

  // Build query string
  const getQueryString = React.useCallback(
    (extraTab?: string) => {
      const params = new URLSearchParams();
      params.set("tab", extraTab || tab);
      params.set("range", range);
      if (range === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }
      return params.toString();
    },
    [tab, range, customFrom, customTo]
  );

  // Export CSV handler
  const handleExport = () => {
    let view = "visitors";
    if (tab === "pages") view = "pages";
    else if (tab === "sources") view = "sources";

    const params = new URLSearchParams();
    params.set("range", range);
    params.set("view", view);
    if (range === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    window.location.href = `/api/liveweb/export?${params.toString()}`;
  };

  // Fetch Live
  const fetchLive = React.useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await fetch("/api/liveweb?tab=live");
      if (res.ok) {
        const json = await res.json();
        setLiveData(json);
        setLastLiveFetch(Date.now());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  // Fetch Overview
  const fetchOverview = React.useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/liveweb?${getQueryString("overview")}`);
      if (res.ok) {
        const json = await res.json();
        setOverviewData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOverviewLoading(false);
    }
  }, [getQueryString]);

  // Fetch Visitors
  const fetchVisitors = React.useCallback(async () => {
    setVisitorsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("tab", "visitors");
      params.set("range", range);
      if (range === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }
      if (filterCity) params.set("city", filterCity);
      if (filterSource) params.set("source", filterSource);
      if (filterReturning) params.set("returning", "true");
      if (filterFormSent) params.set("formSent", "true");
      params.set("page", String(page));

      const res = await fetch(`/api/liveweb?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setVisitorsData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVisitorsLoading(false);
    }
  }, [range, customFrom, customTo, filterCity, filterSource, filterReturning, filterFormSent, page]);

  // Fetch Visit Detail
  const fetchVisitDetail = React.useCallback(async (id: string) => {
    setVisitLoading(true);
    try {
      const res = await fetch(`/api/liveweb?tab=visit&id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        setVisitDetail(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVisitLoading(false);
    }
  }, []);

  // Fetch Pages
  const fetchPages = React.useCallback(async () => {
    setPagesLoading(true);
    try {
      const res = await fetch(`/api/liveweb?${getQueryString("pages")}`);
      if (res.ok) {
        const json = await res.json();
        setPagesData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPagesLoading(false);
    }
  }, [getQueryString]);

  // Fetch Sources
  const fetchSources = React.useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch(`/api/liveweb?${getQueryString("sources")}`);
      if (res.ok) {
        const json = await res.json();
        setSourcesData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSourcesLoading(false);
    }
  }, [getQueryString]);

  // Auto-refresh timer for live screen
  React.useEffect(() => {
    if (tab !== "live") return;
    fetchLive();
    const liveInterval = setInterval(() => {
      fetchLive();
    }, 30000);
    return () => clearInterval(liveInterval);
  }, [tab, fetchLive]);

  // Elapsed seconds timer for live
  React.useEffect(() => {
    if (tab !== "live") return;
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastLiveFetch) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [tab, lastLiveFetch]);

  // Trigger loads on tab or range change
  React.useEffect(() => {
    if (tab === "overview") fetchOverview();
    else if (tab === "visitors" && !selectedVisitId) fetchVisitors();
    else if (tab === "pages") fetchPages();
    else if (tab === "sources") fetchSources();
  }, [tab, range, customFrom, customTo, fetchOverview, fetchVisitors, fetchPages, fetchSources, selectedVisitId]);

  // Load visit detail when selected
  React.useEffect(() => {
    if (selectedVisitId) {
      fetchVisitDetail(selectedVisitId);
    } else {
      setVisitDetail(null);
    }
  }, [selectedVisitId, fetchVisitDetail]);

  const onSelectVisit = (visitId: string) => {
    setSelectedVisitId(visitId);
    setTab("visitors");
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-[#121215] font-sans antialiased">
      {/* 6.2 Top Shell Bar */}
      <header className="sticky top-0 z-40 bg-[#17171B] text-white px-6 py-3.5 border-b border-white/10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md bg-[#E11D2E] text-white font-bold text-xs tracking-wider shadow">
              LW
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold tracking-wider text-sm font-mono text-white">APTHEX</span>
              <span className="text-white/40 text-xs font-mono">·</span>
              <span className="font-medium tracking-wide text-xs text-white/90">LIVEWEB</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 ml-4" aria-label="LiveWeb Navigation">
            {(["overview", "live", "visitors", "pages", "sources"] as ActiveTab[]).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSelectedVisitId(null);
                    setTab(t);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                    active
                      ? "bg-white/15 text-white shadow-sm font-semibold"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {t}
                  {t === "live" && liveData?.onSiteNow > 0 && (
                    <span className="ml-1.5 inline-flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-white/50">apthex.com</span>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-xs font-medium text-white/80">Admin</span>
          <a
            href="/api/auth/logout"
            className="text-xs text-white/50 hover:text-[#E11D2E] transition-colors"
          >
            Sign out
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Controls Toolbar: Date range & Export */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl p-3 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 mr-1 flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Date:
            </span>
            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50/80 p-0.5">
              {(["today", "7d", "30d", "custom"] as DateRange[]).map((r) => {
                const active = range === r;
                const label = r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "Custom";
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      active
                        ? "bg-[#17171B] text-white shadow-sm font-semibold"
                        : "text-zinc-600 hover:text-black hover:bg-zinc-200/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {range === "custom" && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-1 text-xs border border-zinc-200 rounded-md bg-white text-zinc-800"
                />
                <span className="text-xs text-zinc-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-1 text-xs border border-zinc-200 rounded-md bg-white text-zinc-800"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 shadow-sm transition"
            >
              <Download className="size-3.5 text-zinc-500" />
              Export CSV
            </button>
          </div>
        </div>

        {/* 6.2 OVERVIEW SCREEN */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Live Counter Banner */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-black/[0.06] shadow-sm">
              <div className="flex items-center gap-3">
                <span className="relative flex size-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
                </span>
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500">On site now</h3>
                  <p className="text-2xl font-bold font-mono text-[#121215]">
                    {overviewData?.onSiteNow ?? 0}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab("live")}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#E11D2E] hover:underline"
              >
                View live visitors <ChevronRight className="size-3.5" />
              </button>
            </div>

            {/* 6 Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Visitors</span>
                <p className="text-2xl font-bold font-mono text-[#121215] mt-1">
                  {overviewData?.metrics?.visitors?.toLocaleString() ?? 0}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Page Views</span>
                <p className="text-2xl font-bold font-mono text-[#121215] mt-1">
                  {overviewData?.metrics?.pageViews?.toLocaleString() ?? 0}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Avg. Time on Site</span>
                <p className="text-2xl font-bold font-mono text-[#121215] mt-1">
                  {overviewData?.metrics?.avgTimeOnSiteFormatted ?? "0s"}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Forms Sent</span>
                <p className="text-2xl font-bold font-mono text-[#E11D2E] mt-1">
                  {overviewData?.metrics?.formsSent ?? 0}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Apply Clicks</span>
                <p className="text-2xl font-bold font-mono text-[#E11D2E] mt-1">
                  {overviewData?.metrics?.applyClicks ?? 0}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Total Visits</span>
                <p className="text-2xl font-bold font-mono text-[#121215] mt-1">
                  {overviewData?.metrics?.totalVisits?.toLocaleString() ?? 0}
                </p>
              </div>
            </div>

            {/* Line Chart: Visitors Per Day */}
            <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-900">
                    Visitors Per Day
                  </h3>
                  <p className="text-xs text-zinc-500">Daily unique visitors and pageviews (IST)</p>
                </div>
              </div>

              <div className="h-64 w-full">
                {overviewData?.visitorsPerDay && overviewData.visitorsPerDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overviewData.visitorsPerDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#17171B",
                          borderColor: "rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="visitors"
                        stroke="#121215"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Visitors"
                      />
                      <Line
                        type="monotone"
                        dataKey="pageViews"
                        stroke="#E11D2E"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        name="Page Views"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                    No visitor data in this date range yet.
                  </div>
                )}
              </div>
            </div>

            {/* Three Short Lists: Top Pages, Top Sources, Top Cities */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top Pages */}
              <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-800">
                    Top Pages
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">Views</span>
                </div>
                <ul className="space-y-2.5">
                  {(overviewData?.topPages || []).map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-700 truncate max-w-[200px]">{item.page || item.label}</span>
                      <span className="font-mono font-semibold text-zinc-900">{item.views || item.count}</span>
                    </li>
                  ))}
                  {(!overviewData?.topPages || overviewData.topPages.length === 0) && (
                    <li className="text-xs text-zinc-400">No page views recorded yet.</li>
                  )}
                </ul>
              </div>

              {/* Top Sources */}
              <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-800">
                    Top Sources
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">Visitors</span>
                </div>
                <ul className="space-y-2.5">
                  {(overviewData?.topSources || []).map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-700 font-medium">{item.source || item.label}</span>
                      <span className="font-mono font-semibold text-zinc-900">{item.visitors || item.count}</span>
                    </li>
                  ))}
                  {(!overviewData?.topSources || overviewData.topSources.length === 0) && (
                    <li className="text-xs text-zinc-400">No sources recorded yet.</li>
                  )}
                </ul>
              </div>

              {/* Top Cities */}
              <div className="bg-white p-5 rounded-xl border border-black/[0.06] shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-800">
                    Top Cities
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">Visitors</span>
                </div>
                <ul className="space-y-2.5">
                  {(overviewData?.topCities || []).map((item: any, idx: number) => (
                    <li key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-700 font-medium">{item.city || item.label}</span>
                      <span className="font-mono font-semibold text-zinc-900">{item.visitors || item.count}</span>
                    </li>
                  ))}
                  {(!overviewData?.topCities || overviewData.topCities.length === 0) && (
                    <li className="text-xs text-zinc-400">No geo data recorded yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 6.3 LIVE SCREEN */}
        {tab === "live" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm">
              <div className="flex items-center gap-3">
                <span className="relative flex size-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
                </span>
                <div>
                  <h2 className="text-base font-bold text-zinc-900">
                    On site now: <span className="font-mono text-[#E11D2E]">{liveData?.onSiteNow ?? 0}</span>
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Active in the last 5 minutes · Newest first
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="font-mono">Updated {secondsAgo}s ago</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                  Auto-refresh on (30s)
                </span>
                <button
                  type="button"
                  onClick={fetchLive}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50"
                  title="Refresh now"
                >
                  <RefreshCw className={`size-3.5 ${liveLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Live Visitors Table */}
            <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="py-3 px-4">IP</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Device</th>
                      <th className="py-3 px-4">On Page</th>
                      <th className="py-3 px-4">Came From</th>
                      <th className="py-3 px-4 text-center">Pages</th>
                      <th className="py-3 px-4 text-right">Time on Site</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(liveData?.visits || []).map((v: any) => (
                      <tr
                        key={v.id}
                        onClick={() => onSelectVisit(v.id)}
                        className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-zinc-900">{v.ip}</td>
                        <td className="py-3 px-4 text-zinc-600">{v.location}</td>
                        <td className="py-3 px-4 text-zinc-600">{v.device}</td>
                        <td className="py-3 px-4 font-mono text-[#E11D2E] font-medium">{v.onPage}</td>
                        <td className="py-3 px-4 text-zinc-700 font-medium">{v.cameFrom}</td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">{v.pages}</td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-600">{v.timeOnSiteFormatted}</td>
                      </tr>
                    ))}
                    {(!liveData?.visits || liveData.visits.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-zinc-400">
                          No active visitors on the site right now.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 6.4 VISITORS & SINGLE VISIT SCREEN */}
        {tab === "visitors" && (
          <div className="space-y-4">
            {selectedVisitId && visitDetail ? (
              /* Single Visit Detail View (§6.4) */
              <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedVisitId(null)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition"
                    >
                      <ArrowLeft className="size-3.5" /> Back to list
                    </button>
                    <h2 className="text-base font-bold text-zinc-900 font-mono">
                      Visit · {visitDetail.firstSeenFormatted}
                    </h2>
                  </div>

                  <span className="text-xs font-mono text-zinc-500">
                    Total Time: {visitDetail.timeOnSiteFormatted}
                  </span>
                </div>

                {/* Visitor Meta Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200/60 text-xs">
                  <div>
                    <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                      WHO
                    </span>
                    <span className="font-medium text-zinc-900 font-mono">
                      {visitDetail.ip} · {visitDetail.location}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                      DEVICE
                    </span>
                    <span className="font-medium text-zinc-900">{visitDetail.device}</span>
                  </div>
                  <div>
                    <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                      CAME FROM
                    </span>
                    <span className="font-medium text-zinc-900">{visitDetail.source}</span>
                  </div>
                  <div>
                    <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                      HISTORY
                    </span>
                    <span className="font-medium text-zinc-900">
                      {visitDetail.visitCount === 1 ? "1st visit" : `${visitDetail.visitCount}th visit`}
                    </span>
                  </div>
                </div>

                {/* Chronological Page Trail */}
                <div className="space-y-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                    Pages &amp; Actions in Order
                  </h3>

                  <div className="border border-zinc-200/80 rounded-xl overflow-hidden divide-y divide-zinc-100">
                    <div className="grid grid-cols-12 bg-zinc-50 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                      <span className="col-span-2">Time (IST)</span>
                      <span className="col-span-8">Page / Action</span>
                      <span className="col-span-2 text-right">Time on Page</span>
                    </div>

                    {(visitDetail.timeline || []).map((item: any, idx: number) => {
                      const isAction = item.type === "contact_form_submit" || item.type === "apply_click";

                      if (isAction) {
                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-12 px-4 py-2.5 bg-[#E11D2E] text-white font-medium text-xs items-center"
                          >
                            <span className="col-span-2 font-mono text-white/90">{item.timeStr}</span>
                            <span className="col-span-8 font-semibold flex items-center gap-1.5">
                              {item.type === "contact_form_submit" && (
                                <>
                                  <Send className="size-3.5" /> Contact form sent
                                </>
                              )}
                              {item.type === "apply_click" && (
                                <>
                                  <MousePointerClick className="size-3.5" /> Apply clicked: {item.role || "Role"}
                                </>
                              )}
                            </span>
                            <span className="col-span-2 text-right font-mono text-white/90">—</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 px-4 py-2.5 text-xs text-zinc-800 items-center hover:bg-zinc-50/60"
                        >
                          <span className="col-span-2 font-mono text-zinc-500">{item.timeStr}</span>
                          <span className="col-span-8 font-mono font-medium text-zinc-900">{item.page}</span>
                          <span className="col-span-2 text-right font-mono text-zinc-600">
                            {item.timeOnPageFormatted || "0s"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Visitors List & Filters */
              <div className="space-y-4">
                {/* Filter Bar */}
                <div className="bg-white p-4 rounded-xl border border-black/[0.06] shadow-sm flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Filter className="size-3" /> Filters:
                  </span>

                  <input
                    type="text"
                    placeholder="Filter by city (e.g. Pune)"
                    value={filterCity}
                    onChange={(e) => {
                      setFilterCity(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs w-44 bg-zinc-50/50"
                  />

                  <select
                    value={filterSource}
                    onChange={(e) => {
                      setFilterSource(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 border border-zinc-200 rounded-lg text-xs bg-zinc-50/50"
                  >
                    <option value="">All Sources</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Google">Google</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Tally">Tally</option>
                    <option value="X">X</option>
                    <option value="Direct">Direct</option>
                  </select>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-700 ml-2">
                    <input
                      type="checkbox"
                      checked={filterReturning}
                      onChange={(e) => {
                        setFilterReturning(e.target.checked);
                        setPage(1);
                      }}
                      className="rounded border-zinc-300 text-[#E11D2E] focus:ring-[#E11D2E]"
                    />
                    Returning visitors only
                  </label>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-700 ml-2">
                    <input
                      type="checkbox"
                      checked={filterFormSent}
                      onChange={(e) => {
                        setFilterFormSent(e.target.checked);
                        setPage(1);
                      }}
                      className="rounded border-zinc-300 text-[#E11D2E] focus:ring-[#E11D2E]"
                    />
                    Form sent only
                  </label>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                        <tr>
                          <th className="py-3 px-4">Visitor</th>
                          <th className="py-3 px-4">Location</th>
                          <th className="py-3 px-4">Device</th>
                          <th className="py-3 px-4">Source</th>
                          <th className="py-3 px-4">Current Page</th>
                          <th className="py-3 px-4 text-center">Pages</th>
                          <th className="py-3 px-4 text-right">Time on Site</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(visitorsData?.visits || []).map((v: any) => (
                          <tr
                            key={v.id}
                            onClick={() => onSelectVisit(v.id)}
                            className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-4">
                              <span className="font-mono font-medium text-zinc-900 block">{v.ip}</span>
                              {v.isReturning && (
                                <span className="inline-block mt-0.5 text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded font-mono">
                                  {v.visitCount} visits
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-600">{v.location}</td>
                            <td className="py-3 px-4 text-zinc-600">{v.device}</td>
                            <td className="py-3 px-4 font-medium text-zinc-900">{v.source}</td>
                            <td className="py-3 px-4 font-mono text-[#E11D2E]">{v.currentPage}</td>
                            <td className="py-3 px-4 text-center font-mono font-semibold">{v.pages}</td>
                            <td className="py-3 px-4 text-right font-mono text-zinc-600">{v.timeOnSiteFormatted}</td>
                            <td className="py-3 px-4 text-center">
                              {v.formSent && (
                                <span className="inline-block bg-red-100 text-[#E11D2E] text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1">
                                  Form
                                </span>
                              )}
                              {v.applyClicked && (
                                <span className="inline-block bg-zinc-800 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  Apply
                                </span>
                              )}
                              {!v.formSent && !v.applyClicked && <span className="text-zinc-300">—</span>}
                            </td>
                          </tr>
                        ))}
                        {(!visitorsData?.visits || visitorsData.visits.length === 0) && (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-zinc-400">
                              No visitors found matching your criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {visitorsData && visitorsData.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 text-xs">
                      <span className="text-zinc-500 font-mono">
                        Page {visitorsData.page} of {visitorsData.pages} ({visitorsData.total} total)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={visitorsData.page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40"
                        >
                          <ChevronLeft className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={visitorsData.page >= visitorsData.pages}
                          onClick={() => setPage((p) => p + 1)}
                          className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40"
                        >
                          <ChevronRight className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6.5 PAGES SCREEN */}
        {tab === "pages" && (
          <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100">
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-900">
                Pages Performance
              </h2>
              <p className="text-xs text-zinc-500">
                Views, unique readers and average reading time per page, sorted by total views.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-3 px-4">Page Path</th>
                    <th className="py-3 px-4 text-center">Views</th>
                    <th className="py-3 px-4 text-center">Unique Visitors</th>
                    <th className="py-3 px-4 text-right">Avg. Time on Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(pagesData?.pages || []).map((p: any) => (
                    <tr key={p.page} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[#121215]">{p.page}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{p.views?.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-700">{p.visitors?.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-600">{p.avgTimeOnPageFormatted}</td>
                    </tr>
                  ))}
                  {(!pagesData?.pages || pagesData.pages.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-zinc-400">
                        No pages recorded in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6.6 SOURCES SCREEN */}
        {tab === "sources" && (
          <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100">
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-900">
                Traffic Sources
              </h2>
              <p className="text-xs text-zinc-500">
                Source channels from referrer domains. LinkedIn, Google, Instagram, Tally, X and Direct.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-center">Visitors</th>
                    <th className="py-3 px-4 text-center">Pages / Visit</th>
                    <th className="py-3 px-4 text-center">Avg. Time on Site</th>
                    <th className="py-3 px-4 text-center">Forms Sent</th>
                    <th className="py-3 px-4 text-right">Apply Clicks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(sourcesData?.sources || []).map((s: any) => (
                    <tr key={s.source} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-zinc-900">{s.source}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-zinc-900">{s.visitors}</td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-700">{s.pagesPerVisit}</td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-600">{s.avgTimeOnSiteFormatted}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-[#E11D2E]">{s.formsSent}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#E11D2E]">{s.applyClicks}</td>
                    </tr>
                  ))}
                  {(!sourcesData?.sources || sourcesData.sources.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400">
                        No traffic sources recorded in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
