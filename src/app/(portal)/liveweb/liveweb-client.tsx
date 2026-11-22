"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const urlTab = (searchParams.get("tab") as ActiveTab) || "overview";

  const [tab, setTab] = React.useState<ActiveTab>(
    ["overview", "live", "visitors", "pages", "sources"].includes(urlTab) ? urlTab : "overview"
  );
  const [range, setRange] = React.useState<DateRange>("today");
  const [customFrom, setCustomFrom] = React.useState<string>("");
  const [customTo, setCustomTo] = React.useState<string>("");

  React.useEffect(() => {
    if (urlTab && ["overview", "live", "visitors", "pages", "sources"].includes(urlTab)) {
      setTab(urlTab);
    }
  }, [urlTab]);

  const switchTab = (newTab: ActiveTab) => {
    setTab(newTab);
    setSelectedVisitId(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (newTab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", newTab);
      }
      const q = params.toString();
      window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
    }
  };

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

  // Frequent polling for real-time live visitor updates (every 10s)
  React.useEffect(() => {
    fetchLive();
    const liveInterval = setInterval(() => {
      fetchLive();
    }, 10000);
    return () => clearInterval(liveInterval);
  }, [fetchLive]);

  // Elapsed seconds timer
  React.useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastLiveFetch) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastLiveFetch]);

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
    switchTab("visitors");
  };

  const onSiteCount = liveData?.onSiteNow ?? overviewData?.onSiteNow ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-red"></span>
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-red uppercase">
              LIVE WEB ANALYTICS · APTHEX.COM
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white sm:text-3xl mt-1">
            Website Traffic &amp; Visitors
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time visitors, user journey timelines, channels and conversion tracking.
          </p>
        </div>

        {/* Date range & Export */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/[0.04] p-1">
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
                      ? "bg-red text-white shadow-sm font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {range === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 text-xs border border-zinc-200 dark:border-white/10 rounded-md bg-white dark:bg-[#14141a] text-zinc-800 dark:text-zinc-200"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 text-xs border border-zinc-200 dark:border-white/10 rounded-md bg-white dark:bg-[#14141a] text-zinc-800 dark:text-zinc-200"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 bg-white dark:bg-[#14141a] text-xs font-medium text-zinc-700 dark:text-zinc-200 shadow-sm transition"
          >
            <Download className="size-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 dark:border-white/10 pb-3" aria-label="Analytics Tabs">
        {(["overview", "live", "visitors", "pages", "sources"] as ActiveTab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                active
                  ? "bg-red/[0.12] text-red border border-red/30 font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
              }`}
            >
              {t === "overview" && <TrendingUp className="size-3.5" />}
              {t === "live" && <Eye className="size-3.5" />}
              {t === "visitors" && <Users className="size-3.5" />}
              {t === "pages" && <FileCheck2 className="size-3.5" />}
              {t === "sources" && <Layers className="size-3.5" />}
              <span>{t === "live" ? "Live Active" : t}</span>
              {t === "live" && (
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-red"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW SCREEN */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Live Counter Banner with Heartbeat & Wave */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-[#14141a] border border-zinc-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-red/10 border border-red/20 text-red shadow-[0_0_12px_rgba(225,29,46,0.25)]">
                <Activity className="size-5 animate-pulse" />
              </span>
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                  On Site Now
                </span>
                <p className="text-3xl font-bold tabular-nums text-ink dark:text-white leading-tight">
                  {onSiteCount}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Soundwave Bars Visual */}
              <div className="hidden md:flex items-center gap-1 opacity-70">
                <span className="w-1 h-3 rounded-full bg-red animate-pulse" />
                <span className="w-1 h-6 rounded-full bg-red animate-pulse delay-75" />
                <span className="w-1 h-2 rounded-full bg-red animate-pulse delay-150" />
                <span className="w-1 h-7 rounded-full bg-red animate-pulse" />
                <span className="w-1 h-4 rounded-full bg-red animate-pulse delay-100" />
                <span className="w-1 h-3 rounded-full bg-red animate-pulse delay-200" />
              </div>

              <button
                type="button"
                onClick={() => switchTab("live")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red/30 bg-red/[0.08] text-xs font-semibold text-red hover:bg-red/15 transition shadow-sm"
              >
                <span>View Live Visitors</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          {/* 6 Metric Cards with Sparklines */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Visitors */}
            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Users className="size-3.5" /> Visitors
                </span>
                <p className="text-2xl font-bold tabular-nums text-ink dark:text-white mt-1">
                  {overviewData?.metrics?.visitors?.toLocaleString() ?? 0}
                </p>
              </div>
              <svg className="w-12 h-6 text-zinc-400 dark:text-zinc-600 shrink-0" viewBox="0 0 64 32" fill="none">
                <path d="M2 28 C 16 28, 24 16, 36 22 C 48 26, 52 8, 62 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* 2. Page Views */}
            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <FileCheck2 className="size-3.5" /> Page Views
                </span>
                <p className="text-2xl font-bold tabular-nums text-ink dark:text-white mt-1">
                  {overviewData?.metrics?.pageViews?.toLocaleString() ?? 0}
                </p>
              </div>
              <svg className="w-12 h-6 text-zinc-400 dark:text-zinc-600 shrink-0" viewBox="0 0 64 32" fill="none">
                <path d="M2 24 C 14 26, 22 18, 32 20 C 44 22, 50 10, 62 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* 3. Avg. Time */}
            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Clock className="size-3.5" /> Avg. Time
                </span>
                <p className="text-2xl font-bold tabular-nums text-ink dark:text-white mt-1">
                  {overviewData?.metrics?.avgTimeOnSiteFormatted ?? "0s"}
                </p>
              </div>
              <svg className="w-12 h-6 text-zinc-400 dark:text-zinc-600 shrink-0" viewBox="0 0 64 32" fill="none">
                <path d="M2 20 C 18 20, 26 24, 38 16 C 46 10, 54 14, 62 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* 4. Forms Sent */}
            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-red/30 shadow-sm flex items-center justify-between bg-gradient-to-br from-transparent to-red/[0.04]">
              <div>
                <span className="text-[11px] font-medium tracking-wide text-red flex items-center gap-1">
                  <Send className="size-3.5" /> Forms Sent
                </span>
                <p className="text-2xl font-bold tabular-nums text-red mt-1">
                  {overviewData?.metrics?.formsSent ?? 0}
                </p>
              </div>
              <svg className="w-12 h-6 text-red/60 shrink-0" viewBox="0 0 64 32" fill="none">
                <path d="M2 28 C 16 28, 24 16, 36 22 C 48 26, 52 8, 62 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* 5. Apply Clicks */}
            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-red/30 shadow-sm flex items-center justify-between bg-gradient-to-br from-transparent to-red/[0.04]">
              <div>
                <span className="text-[11px] font-medium tracking-wide text-red flex items-center gap-1">
                  <MousePointerClick className="size-3.5" /> Apply Clicks
                </span>
                <p className="text-2xl font-bold tabular-nums text-red mt-1">
                  {overviewData?.metrics?.applyClicks ?? 0}
                </p>
              </div>
              <svg className="w-12 h-6 text-red/60 shrink-0" viewBox="0 0 64 32" fill="none">
                <path d="M2 26 C 14 26, 26 12, 38 18 C 48 22, 54 6, 62 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* 6. Total Visits */}
            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Eye className="size-3.5" /> Total Visits
                </span>
                <p className="text-2xl font-bold tabular-nums text-ink dark:text-white mt-1">
                  {overviewData?.metrics?.totalVisits?.toLocaleString() ?? 0}
                </p>
              </div>
              <svg className="w-12 h-6 text-zinc-400 dark:text-zinc-600 shrink-0" viewBox="0 0 64 32" fill="none">
                <path d="M2 22 C 16 26, 28 14, 40 18 C 50 20, 56 10, 62 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Line Chart: Visitors Per Day */}
          <div className="bg-white dark:bg-[#14141a] p-5 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-ink dark:text-white">
                  Visitors per Day
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Daily unique visitors and pageviews (IST)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="size-2 rounded-full bg-emerald-500" /> Visitors
                </span>
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="size-2 rounded-full bg-red" /> Page Views
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              {overviewData?.visitorsPerDay && overviewData.visitorsPerDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overviewData.visitorsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                    <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#14141a",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke="#10b981"
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
                <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-400 gap-2">
                  <Activity className="size-6 text-zinc-400/60" />
                  <span>{overviewLoading ? "Loading visitor metrics…" : "No visitor data in this date range yet."}</span>
                </div>
              )}
            </div>
          </div>

          {/* Top Pages, Top Sources, Top Cities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Pages */}
            <div className="bg-white dark:bg-[#14141a] p-5 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-white/5 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink dark:text-zinc-200 flex items-center gap-1.5">
                  <FileCheck2 className="size-3.5 text-zinc-400" /> Top Pages
                </span>
                <span className="text-[11px] text-zinc-400">Views</span>
              </div>
              <ul className="space-y-2.5">
                {(overviewData?.topPages || []).map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{item.page || item.label}</span>
                    <span className="font-bold tabular-nums text-ink dark:text-white">{item.views || item.count}</span>
                  </li>
                ))}
                {(!overviewData?.topPages || overviewData.topPages.length === 0) && (
                  <li className="text-xs text-zinc-400 text-center py-4">No page data yet.</li>
                )}
              </ul>
            </div>

            {/* Top Sources */}
            <div className="bg-white dark:bg-[#14141a] p-5 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-white/5 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink dark:text-zinc-200 flex items-center gap-1.5">
                  <Layers className="size-3.5 text-zinc-400" /> Top Sources
                </span>
                <span className="text-[11px] text-zinc-400">Visitors</span>
              </div>
              <ul className="space-y-2.5">
                {(overviewData?.topSources || []).map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.source || item.label}</span>
                    <span className="font-bold tabular-nums text-ink dark:text-white">{item.visitors || item.count}</span>
                  </li>
                ))}
                {(!overviewData?.topSources || overviewData.topSources.length === 0) && (
                  <li className="text-xs text-zinc-400 text-center py-4">No source data yet.</li>
                )}
              </ul>
            </div>

            {/* Top Cities */}
            <div className="bg-white dark:bg-[#14141a] p-5 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-white/5 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink dark:text-zinc-200 flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-zinc-400" /> Top Cities
                </span>
                <span className="text-[11px] text-zinc-400">Visitors</span>
              </div>
              <ul className="space-y-2.5">
                {(overviewData?.topCities || []).map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{item.city || item.label}</span>
                    <span className="font-bold tabular-nums text-ink dark:text-white">{item.visitors || item.count}</span>
                  </li>
                ))}
                {(!overviewData?.topCities || overviewData.topCities.length === 0) && (
                  <li className="text-xs text-zinc-400 text-center py-4">No city data yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* LIVE ACTIVE SCREEN */}
      {tab === "live" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-[#14141a] border border-zinc-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75"></span>
                <span className="relative inline-flex rounded-full size-3 bg-red"></span>
              </span>
              <div>
                <span className="text-xs font-semibold tracking-wider text-red uppercase">
                  Live Active Visitors
                </span>
                <p className="text-2xl font-bold tabular-nums text-ink dark:text-white">
                  {onSiteCount} active now
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="tabular-nums">Updated {secondsAgo}s ago</span>
              <button
                type="button"
                onClick={fetchLive}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition"
                title="Refresh now"
              >
                <RefreshCw className={`size-3.5 ${liveLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Live Visitors Table */}
          <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                  {(liveData?.visits || []).map((v: any) => (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVisit(v.id)}
                      className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-medium tabular-nums text-ink dark:text-white">{v.ip}</td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.location}</td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.device}</td>
                      <td className="py-3 px-4 text-red font-medium">{v.onPage}</td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">{v.cameFrom}</td>
                      <td className="py-3 px-4 text-center font-bold tabular-nums text-ink dark:text-white">{v.pages}</td>
                      <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">{v.timeOnSiteFormatted}</td>
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

      {/* VISITORS & SINGLE VISIT SCREEN */}
      {tab === "visitors" && (
        <div className="space-y-4">
          {selectedVisitId && visitDetail ? (
            /* Single Visit Detail View */
            <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedVisitId(null)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition"
                  >
                    <ArrowLeft className="size-3.5" /> Back to list
                  </button>
                  <h2 className="text-base font-bold text-ink dark:text-white">
                    Visit · {visitDetail.firstSeenFormatted}
                  </h2>
                </div>

                <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  Total Time: {visitDetail.timeOnSiteFormatted}
                </span>
              </div>

              {/* Visitor Meta Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50 dark:bg-white/[0.02] p-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs">
                <div>
                  <span className="uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    WHO
                  </span>
                  <span className="font-semibold text-ink dark:text-white tabular-nums">
                    {visitDetail.ip} · {visitDetail.location}
                  </span>
                </div>
                <div>
                  <span className="uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    DEVICE
                  </span>
                  <span className="font-medium text-ink dark:text-white">{visitDetail.device}</span>
                </div>
                <div>
                  <span className="uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    CAME FROM
                  </span>
                  <span className="font-medium text-ink dark:text-white">{visitDetail.source}</span>
                </div>
                <div>
                  <span className="uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    HISTORY
                  </span>
                  <span className="font-medium text-ink dark:text-white">
                    {visitDetail.visitCount === 1 ? "1st visit" : `${visitDetail.visitCount}th visit`}
                  </span>
                </div>
              </div>

              {/* Chronological Page Trail */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Pages &amp; Actions in Order
                </h3>

                <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-white/5">
                  <div className="grid grid-cols-12 bg-zinc-50 dark:bg-white/[0.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span className="col-span-2">Time (IST)</span>
                    <span className="col-span-8">Page / Action</span>
                    <span className="col-span-2 text-right">Time on Page</span>
                  </div>

                  {(visitDetail.timeline || []).map((ev: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="col-span-2 text-zinc-500 dark:text-zinc-400 tabular-nums">{ev.timeStr}</span>
                      <div className="col-span-8 flex items-center gap-2">
                        {ev.type === "pageview" && (
                          <span className="font-medium text-ink dark:text-white">{ev.page}</span>
                        )}
                        {ev.type === "contact_form_submit" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red/10 text-red text-[11px] font-semibold">
                            <Send className="size-3" /> Submitted Contact Form
                          </span>
                        )}
                        {ev.type === "apply_click" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 dark:bg-white/10 text-white text-[11px] font-semibold">
                            <MousePointerClick className="size-3" /> Clicked Apply: {ev.role || "Open Role"}
                          </span>
                        )}
                      </div>
                      <span className="col-span-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {ev.timeOnPageFormatted || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Visitor Log Table with Filters */
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#14141a] p-3 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm text-xs">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Filter className="size-3.5" />
                  <span className="uppercase tracking-wider text-[11px] font-semibold">Filter:</span>
                </div>

                <input
                  type="text"
                  placeholder="Filter by city…"
                  value={filterCity}
                  onChange={(e) => {
                    setFilterCity(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-zinc-200 dark:border-white/10 rounded-lg bg-zinc-50 dark:bg-white/[0.03] text-ink dark:text-white placeholder:text-zinc-400 text-xs w-36"
                />

                <select
                  value={filterSource}
                  onChange={(e) => {
                    setFilterSource(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-zinc-200 dark:border-white/10 rounded-lg bg-zinc-50 dark:bg-white/[0.03] text-ink dark:text-white text-xs"
                >
                  <option value="">All Sources</option>
                  <option value="Direct">Direct</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Google">Google</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Tally">Tally</option>
                  <option value="X">X (Twitter)</option>
                </select>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-700 dark:text-zinc-300 ml-2">
                  <input
                    type="checkbox"
                    checked={filterReturning}
                    onChange={(e) => {
                      setFilterReturning(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-zinc-300 text-red focus:ring-red"
                  />
                  Returning visitors
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-700 dark:text-zinc-300 ml-2">
                  <input
                    type="checkbox"
                    checked={filterFormSent}
                    onChange={(e) => {
                      setFilterFormSent(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-zinc-300 text-red focus:ring-red"
                  />
                  Form sent only
                </label>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <tr>
                        <th className="py-3 px-4">Visitor</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Device</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Current Page</th>
                        <th className="py-3 px-4 text-center">Pages</th>
                        <th className="py-3 px-4 text-right">Time on Site</th>
                        <th className="py-3 px-4 text-center">Conversions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                      {(visitorsData?.visits || []).map((v: any) => (
                        <tr
                          key={v.id}
                          onClick={() => onSelectVisit(v.id)}
                          className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-semibold tabular-nums text-ink dark:text-white block">{v.ip}</span>
                            {v.isReturning && (
                              <span className="inline-block mt-0.5 text-[10px] bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.2 rounded font-sans">
                                {v.visitCount} visits
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.location}</td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.device}</td>
                          <td className="py-3 px-4 font-medium text-ink dark:text-white">{v.source}</td>
                          <td className="py-3 px-4 text-red font-medium">{v.currentPage}</td>
                          <td className="py-3 px-4 text-center font-bold tabular-nums text-ink dark:text-white">{v.pages}</td>
                          <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">{v.timeOnSiteFormatted}</td>
                          <td className="py-3 px-4 text-center">
                            {v.formSent && (
                              <span className="inline-block bg-red/10 text-red text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1">
                                Form
                              </span>
                            )}
                            {v.applyClicked && (
                              <span className="inline-block bg-zinc-800 dark:bg-white/10 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                Apply
                              </span>
                            )}
                            {!v.formSent && !v.applyClicked && <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                          </td>
                        </tr>
                      ))}
                      {(!visitorsData?.visits || visitorsData.visits.length === 0) && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-zinc-400">
                            {visitorsLoading ? "Loading visitors…" : "No visitor logs found."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {visitorsData?.pagination && visitorsData.pagination.pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      Page {visitorsData.pagination.page} of {visitorsData.pagination.pages} ({visitorsData.pagination.total} total)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-2 py-1 rounded border border-zinc-200 dark:border-white/10 disabled:opacity-40 hover:bg-white dark:hover:bg-white/5 transition"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={page >= visitorsData.pagination.pages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-2 py-1 rounded border border-zinc-200 dark:border-white/10 disabled:opacity-40 hover:bg-white dark:hover:bg-white/5 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAGES SCREEN */}
      {tab === "pages" && (
        <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-white/5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink dark:text-white">
              Pages Performance
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Views, unique readers and average reading time per page, sorted by total views.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Page Path</th>
                  <th className="py-3 px-4 text-center">Views</th>
                  <th className="py-3 px-4 text-center">Unique Visitors</th>
                  <th className="py-3 px-4 text-right">Avg. Time on Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {(pagesData?.pages || []).map((p: any) => (
                  <tr key={p.page} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-medium text-ink dark:text-white">{p.page}</td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums text-ink dark:text-white">{p.views?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{p.visitors?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">{p.avgTimeOnPageFormatted}</td>
                  </tr>
                ))}
                {(!pagesData?.pages || pagesData.pages.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-zinc-400">
                      {pagesLoading ? "Loading pages…" : "No pages recorded in this range."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOURCES SCREEN */}
      {tab === "sources" && (
        <div className="bg-white dark:bg-[#14141a] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-white/5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink dark:text-white">
              Traffic Sources
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Source channels from referrer domains: LinkedIn, Google, Instagram, Tally, X, Direct.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-center">Visitors</th>
                  <th className="py-3 px-4 text-center">Pages / Visit</th>
                  <th className="py-3 px-4 text-center">Avg. Time on Site</th>
                  <th className="py-3 px-4 text-center">Forms Sent</th>
                  <th className="py-3 px-4 text-right">Apply Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {(sourcesData?.sources || []).map((s: any) => (
                  <tr key={s.source} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-ink dark:text-white">{s.source}</td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums text-ink dark:text-white">{s.visitors}</td>
                    <td className="py-3 px-4 text-center font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{s.pagesPerVisit}</td>
                    <td className="py-3 px-4 text-center text-zinc-600 dark:text-zinc-400 tabular-nums">{s.avgTimeOnSiteFormatted}</td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums text-red">{s.formsSent}</td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums text-red">{s.applyClicks}</td>
                  </tr>
                ))}
                {(!sourcesData?.sources || sourcesData.sources.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400">
                      {sourcesLoading ? "Loading sources…" : "No traffic sources recorded in this range."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
