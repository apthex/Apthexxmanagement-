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
    <div className="space-y-6">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Live Web Analytics · apthex.com
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink dark:text-white sm:text-3xl mt-1">
            Website Traffic &amp; Visitors
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time visitors, user journey timelines, channels &amp; conversion tracking.
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
              onClick={() => {
                setSelectedVisitId(null);
                setTab(t);
              }}
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW SCREEN */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Live Counter Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#14141a] border border-zinc-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
              </span>
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">On site now</h3>
                <p className="text-2xl font-bold font-mono text-ink dark:text-white">
                  {overviewData?.onSiteNow ?? 0}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTab("live")}
              className="inline-flex items-center gap-1 text-xs font-medium text-red hover:underline"
            >
              View live visitors <ChevronRight className="size-3.5" />
            </button>
          </div>

          {/* 6 Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Visitors</span>
              <p className="text-2xl font-bold font-mono text-ink dark:text-white mt-1">
                {overviewData?.metrics?.visitors?.toLocaleString() ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Page Views</span>
              <p className="text-2xl font-bold font-mono text-ink dark:text-white mt-1">
                {overviewData?.metrics?.pageViews?.toLocaleString() ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Avg. Time</span>
              <p className="text-2xl font-bold font-mono text-ink dark:text-white mt-1">
                {overviewData?.metrics?.avgTimeOnSiteFormatted ?? "0s"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-red/20 shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-red">Forms Sent</span>
              <p className="text-2xl font-bold font-mono text-red mt-1">
                {overviewData?.metrics?.formsSent ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-red/20 shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-red">Apply Clicks</span>
              <p className="text-2xl font-bold font-mono text-red mt-1">
                {overviewData?.metrics?.applyClicks ?? 0}
              </p>
            </div>

            <div className="bg-white dark:bg-[#14141a] p-4 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Visits</span>
              <p className="text-2xl font-bold font-mono text-ink dark:text-white mt-1">
                {overviewData?.metrics?.totalVisits?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>

          {/* Line Chart: Visitors Per Day */}
          <div className="bg-white dark:bg-[#14141a] p-5 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-ink dark:text-white">
                  Visitors Per Day
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Daily unique visitors and pageviews (IST)</p>
              </div>
            </div>

            <div className="h-64 w-full">
              {overviewData?.visitorsPerDay && overviewData.visitorsPerDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overviewData.visitorsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
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
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                  {overviewLoading ? "Loading visitor metrics…" : "No visitor data in this date range yet."}
                </div>
              )}
            </div>
          </div>

          {/* Top Pages, Top Sources, Top Cities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Pages */}
            <div className="bg-white dark:bg-[#14141a] p-5 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-white/5 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink dark:text-zinc-200">
                  Top Pages
                </span>
                <span className="text-[11px] font-mono text-zinc-400">Views</span>
              </div>
              <ul className="space-y-2.5">
                {(overviewData?.topPages || []).map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{item.page || item.label}</span>
                    <span className="font-mono font-semibold text-ink dark:text-white">{item.views || item.count}</span>
                  </li>
                ))}
                {(!overviewData?.topPages || overviewData.topPages.length === 0) && (
                  <li className="text-xs text-zinc-400 text-center py-4">No page data yet.</li>
                )}
              </ul>
            </div>

            {/* Top Sources */}
            <div className="bg-white dark:bg-[#14141a] p-5 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-white/5 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink dark:text-zinc-200">
                  Top Sources
                </span>
                <span className="text-[11px] font-mono text-zinc-400">Visitors</span>
              </div>
              <ul className="space-y-2.5">
                {(overviewData?.topSources || []).map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.source || item.label}</span>
                    <span className="font-mono font-semibold text-ink dark:text-white">{item.visitors || item.count}</span>
                  </li>
                ))}
                {(!overviewData?.topSources || overviewData.topSources.length === 0) && (
                  <li className="text-xs text-zinc-400 text-center py-4">No source data yet.</li>
                )}
              </ul>
            </div>

            {/* Top Cities */}
            <div className="bg-white dark:bg-[#14141a] p-5 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-white/5 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink dark:text-zinc-200">
                  Top Cities
                </span>
                <span className="text-[11px] font-mono text-zinc-400">Visitors</span>
              </div>
              <ul className="space-y-2.5">
                {(overviewData?.topCities || []).map((item: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{item.city || item.label}</span>
                    <span className="font-mono font-semibold text-ink dark:text-white">{item.visitors || item.count}</span>
                  </li>
                ))}
                {(!overviewData?.topCities || overviewData.topCities.length === 0) && (
                  <li className="text-xs text-zinc-400 text-center py-4">No city data yet.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Device Distribution */}
          <div className="bg-white dark:bg-[#14141a] p-5 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink dark:text-zinc-200 block mb-3">
              Device Distribution
            </span>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] rounded-lg border border-zinc-100 dark:border-white/5">
                <Laptop className="size-4 mx-auto text-zinc-400 mb-1" />
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 block">Desktop</span>
                <span className="text-base font-bold font-mono text-ink dark:text-white">
                  {overviewData?.devices?.desktop ?? 0}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] rounded-lg border border-zinc-100 dark:border-white/5">
                <Globe className="size-4 mx-auto text-zinc-400 mb-1" />
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 block">Mobile</span>
                <span className="text-base font-bold font-mono text-ink dark:text-white">
                  {overviewData?.devices?.mobile ?? 0}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-white/[0.02] rounded-lg border border-zinc-100 dark:border-white/5">
                <Layers className="size-4 mx-auto text-zinc-400 mb-1" />
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 block">Tablet</span>
                <span className="text-base font-bold font-mono text-ink dark:text-white">
                  {overviewData?.devices?.tablet ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE ACTIVE SCREEN */}
      {tab === "live" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#14141a] border border-zinc-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
              </span>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                  Live Active Visitors
                </span>
                <p className="text-2xl font-bold font-mono text-ink dark:text-white">
                  {liveData?.onSiteNow ?? 0} active now
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-mono">Updated {secondsAgo}s ago</span>
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
          <div className="bg-white dark:bg-[#14141a] rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                      <td className="py-3 px-4 font-mono font-medium text-ink dark:text-white">{v.ip}</td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.location}</td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.device}</td>
                      <td className="py-3 px-4 font-mono text-red font-medium">{v.onPage}</td>
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">{v.cameFrom}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-ink dark:text-white">{v.pages}</td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">{v.timeOnSiteFormatted}</td>
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
            <div className="bg-white dark:bg-[#14141a] rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedVisitId(null)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition"
                  >
                    <ArrowLeft className="size-3.5" /> Back to list
                  </button>
                  <h2 className="text-base font-bold text-ink dark:text-white font-mono">
                    Visit · {visitDetail.firstSeenFormatted}
                  </h2>
                </div>

                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  Total Time: {visitDetail.timeOnSiteFormatted}
                </span>
              </div>

              {/* Visitor Meta Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50 dark:bg-white/[0.02] p-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs">
                <div>
                  <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    WHO
                  </span>
                  <span className="font-medium text-ink dark:text-white font-mono">
                    {visitDetail.ip} · {visitDetail.location}
                  </span>
                </div>
                <div>
                  <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    DEVICE
                  </span>
                  <span className="font-medium text-ink dark:text-white">{visitDetail.device}</span>
                </div>
                <div>
                  <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    CAME FROM
                  </span>
                  <span className="font-medium text-ink dark:text-white">{visitDetail.source}</span>
                </div>
                <div>
                  <span className="font-mono uppercase tracking-wider text-[10px] text-zinc-400 block mb-0.5">
                    HISTORY
                  </span>
                  <span className="font-medium text-ink dark:text-white">
                    {visitDetail.visitCount === 1 ? "1st visit" : `${visitDetail.visitCount}th visit`}
                  </span>
                </div>
              </div>

              {/* Chronological Page Trail */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Pages &amp; Actions in Order
                </h3>

                <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-white/5">
                  <div className="grid grid-cols-12 bg-zinc-50 dark:bg-white/[0.02] px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span className="col-span-2">Time (IST)</span>
                    <span className="col-span-8">Page / Action</span>
                    <span className="col-span-2 text-right">Time on Page</span>
                  </div>

                  {(visitDetail.timeline || []).map((ev: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 px-4 py-3 text-xs items-center hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="col-span-2 font-mono text-zinc-500 dark:text-zinc-400">{ev.timeStr}</span>
                      <div className="col-span-8 flex items-center gap-2">
                        {ev.type === "pageview" && (
                          <span className="font-mono font-medium text-ink dark:text-white">{ev.page}</span>
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
                      <span className="col-span-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
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
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#14141a] p-3 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm text-xs">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Filter className="size-3.5" />
                  <span className="font-mono uppercase tracking-wider text-[11px]">Filter:</span>
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
              <div className="bg-white dark:bg-[#14141a] rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                            <span className="font-mono font-medium text-ink dark:text-white block">{v.ip}</span>
                            {v.isReturning && (
                              <span className="inline-block mt-0.5 text-[10px] bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.2 rounded font-mono">
                                {v.visitCount} visits
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.location}</td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{v.device}</td>
                          <td className="py-3 px-4 font-medium text-ink dark:text-white">{v.source}</td>
                          <td className="py-3 px-4 font-mono text-red">{v.currentPage}</td>
                          <td className="py-3 px-4 text-center font-mono font-semibold text-ink dark:text-white">{v.pages}</td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">{v.timeOnSiteFormatted}</td>
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
        <div className="bg-white dark:bg-[#14141a] rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-white/5">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-ink dark:text-white">
              Pages Performance
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Views, unique readers and average reading time per page, sorted by total views.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                    <td className="py-3 px-4 font-mono font-medium text-ink dark:text-white">{p.page}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-ink dark:text-white">{p.views?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-700 dark:text-zinc-300">{p.visitors?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">{p.avgTimeOnPageFormatted}</td>
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
        <div className="bg-white dark:bg-[#14141a] rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-white/5">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-ink dark:text-white">
              Traffic Sources
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Source channels from referrer domains: LinkedIn, Google, Instagram, Tally, X, Direct.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                    <td className="py-3 px-4 text-center font-mono font-bold text-ink dark:text-white">{s.visitors}</td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-700 dark:text-zinc-300">{s.pagesPerVisit}</td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-600 dark:text-zinc-400">{s.avgTimeOnSiteFormatted}</td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-red">{s.formsSent}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-red">{s.applyClicks}</td>
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
