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
  ShieldCheck,
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
  const [range, setRange] = React.useState<DateRange>("7d");
  const [customFrom, setCustomFrom] = React.useState<string>("");
  const [customTo, setCustomTo] = React.useState<string>("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const getAuthHeaders = React.useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      try {
        const token = localStorage.getItem("apt_session");
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {}
    }
    return headers;
  }, []);

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
      const res = await fetch("/api/liveweb?tab=live", {
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
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
  }, [getAuthHeaders]);

  // Fetch Overview
  const fetchOverview = React.useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/liveweb?${getQueryString("overview")}`, {
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setOverviewData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOverviewLoading(false);
    }
  }, [getQueryString, getAuthHeaders]);

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

      const res = await fetch(`/api/liveweb?${params.toString()}`, {
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setVisitorsData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVisitorsLoading(false);
    }
  }, [range, customFrom, customTo, filterCity, filterSource, filterReturning, filterFormSent, page, getAuthHeaders]);

  // Fetch Visit Detail
  const fetchVisitDetail = React.useCallback(async (id: string) => {
    setVisitLoading(true);
    try {
      const res = await fetch(`/api/liveweb?tab=visit&id=${encodeURIComponent(id)}`, {
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setVisitDetail(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVisitLoading(false);
    }
  }, [getAuthHeaders]);

  // Fetch Pages
  const fetchPages = React.useCallback(async () => {
    setPagesLoading(true);
    try {
      const res = await fetch(`/api/liveweb?${getQueryString("pages")}`, {
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setPagesData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPagesLoading(false);
    }
  }, [getQueryString, getAuthHeaders]);

  // Fetch Sources
  const fetchSources = React.useCallback(async () => {
    setSourcesLoading(true);
    try {
      const res = await fetch(`/api/liveweb?${getQueryString("sources")}`, {
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setSourcesData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSourcesLoading(false);
    }
  }, [getQueryString, getAuthHeaders]);

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

  const defaultEmptyDates = React.useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 8; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      dates.push(d.toLocaleDateString("en-US", { day: "numeric", month: "short" }));
    }
    return dates;
  }, []);

  return (
    <div className="relative space-y-6">
      {/* Ambient Crimson Ribbon Wave in Top Right */}
      <div className="pointer-events-none absolute -top-4 right-0 h-[260px] w-[580px] overflow-hidden opacity-40 select-none z-0">
        <svg viewBox="0 0 580 260" className="w-full h-full" fill="none">
          <defs>
            <linearGradient id="redWaveRibbon" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="45%" stopColor="#b91c1c" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#450a0a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="redWaveRibbon2" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#991b1b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#450a0a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 40 160 C 200 260, 360 60, 580 110" stroke="url(#redWaveRibbon)" strokeWidth="3" filter="drop-shadow(0 0 12px rgba(239,68,68,0.5))" />
          <path d="M 20 190 C 180 290, 340 90, 580 140" stroke="url(#redWaveRibbon2)" strokeWidth="1.5" />
          <path d="M 80 130 C 230 230, 380 40, 580 80" stroke="url(#redWaveRibbon2)" strokeWidth="1" opacity="0.4" />
        </svg>
      </div>

      {/* Top Header & Toolbar */}
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-red-500 shadow-[0_0_8px_#ef4444]"></span>
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-red-500 uppercase">
              LIVE WEB ANALYTICS · APTHEX.COM
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl mt-1">
            Website Traffic &amp; Visitors
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time visitors, user journey timelines, channels and conversion tracking.
          </p>
        </div>

        {/* Date range & Export */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#0e1017] p-1">
            {(["today", "7d", "30d", "custom"] as DateRange[]).map((r) => {
              const active = range === r;
              const label = r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "Custom";
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${active
                    ? "bg-[#8a141e] text-white shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
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
                className="px-2 py-1 text-xs border border-white/10 rounded-md bg-[#14141a] text-zinc-200"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 text-xs border border-white/10 rounded-md bg-[#14141a] text-zinc-200"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/20 bg-[#0e1017] text-xs font-medium text-zinc-300 shadow-sm transition"
          >
            <Download className="size-3.5 text-zinc-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="relative z-10 flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] pb-3" aria-label="Analytics Tabs">
        {(["overview", "live", "visitors", "pages", "sources"] as ActiveTab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${active
                ? "bg-red-950/40 text-red-400 border border-red-500/30 font-semibold shadow-[0_0_12px_rgba(239,68,68,0.12)]"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-red-500 shadow-[0_0_6px_#ef4444]"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW SCREEN */}
      {tab === "overview" && (
        <div className="relative z-10 space-y-6">
          {/* Live Counter Banner with Heartbeat & Wave */}
          <div className="flex items-center justify-between p-4 sm:p-5 rounded-xl bg-[#0c0e14] border border-white/[0.07] shadow-sm">
            <div className="flex items-center gap-3.5">
              <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-red-600/30 to-red-950/50 border border-red-500/40 text-red-500 shadow-[0_0_18px_rgba(239,68,68,0.35)] shrink-0">
                <Activity className="size-5 animate-pulse" />
              </span>
              <div>
                <span className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
                  On Site Now
                </span>
                <p className="text-3xl font-bold tabular-nums text-white leading-tight">
                  {onSiteCount}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Soundwave Bars Visual */}
              <div className="hidden sm:flex items-end gap-1 h-7 opacity-75">
                {[14, 24, 10, 28, 16, 26, 8, 22, 14, 25, 18, 28, 12, 22, 16, 10].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}px` }}
                    className={`w-[3px] rounded-full transition-all duration-300 ${i % 4 === 1 ? "bg-red-500" : "bg-zinc-600"
                      }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => switchTab("live")}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-500/30 bg-red-950/20 text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition shadow-sm"
              >
                <span>View Live Visitors</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          {/* 7 Metric Cards with Sparklines */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* 1. Visitors */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                <Users className="size-3.5 text-zinc-400" />
                <span>Visitors</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {overviewData?.metrics?.visitors?.toLocaleString() ?? 0}
                </span>
                <svg className="w-14 h-7 text-zinc-500/40 shrink-0" viewBox="0 0 64 28" fill="none">
                  <path d="M2 24 C 16 24, 24 14, 36 18 C 48 22, 52 6, 62 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* 2. Page Views */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                <FileCheck2 className="size-3.5 text-zinc-400" />
                <span>Page Views</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {overviewData?.metrics?.pageViews?.toLocaleString() ?? 0}
                </span>
                <svg className="w-14 h-7 text-zinc-500/40 shrink-0" viewBox="0 0 64 28" fill="none">
                  <path d="M2 20 C 14 22, 22 14, 32 16 C 44 18, 50 8, 62 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* 3. Avg. Time */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                <Clock className="size-3.5 text-zinc-400" />
                <span>Avg. Time</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {overviewData?.metrics?.avgTimeOnSiteFormatted ?? "0s"}
                </span>
                <svg className="w-14 h-7 text-zinc-500/40 shrink-0" viewBox="0 0 64 28" fill="none">
                  <path d="M2 18 C 18 18, 26 22, 38 14 C 46 8, 54 12, 62 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* 4. Forms Sent (RED ACCENT CARD) */}
            <div className="bg-[#140b0e] border border-red-500/30 p-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.06)] flex flex-col justify-between h-24">
              <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                <Send className="size-3.5 text-red-500" />
                <span>Forms Sent</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {overviewData?.metrics?.formsSent ?? 0}
                </span>
                <svg className="w-14 h-7 text-red-500/80 shrink-0" viewBox="0 0 64 28" fill="none">
                  <path d="M2 24 C 16 24, 24 14, 36 18 C 48 22, 52 6, 62 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* 5. Apply Clicks (RED ACCENT CARD) */}
            <div className="bg-[#140b0e] border border-red-500/30 p-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.06)] flex flex-col justify-between h-24">
              <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                <MousePointerClick className="size-3.5 text-red-500" />
                <span>Apply Clicks</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {overviewData?.metrics?.applyClicks ?? 0}
                </span>
                <svg className="w-14 h-7 text-red-500/80 shrink-0" viewBox="0 0 64 28" fill="none">
                  <path d="M2 22 C 14 22, 26 10, 38 15 C 48 18, 54 4, 62 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* 6. Assessment Clicks (RED ACCENT CARD) */}
            <div className="bg-[#140b0e] border border-red-500/30 p-4 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.06)] flex flex-col justify-between h-24">
              <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                <ShieldCheck className="size-3.5 text-red-500" />
                <span>Assessments</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {overviewData?.metrics?.assessmentClicks ?? 0}
                </span>
                <svg className="w-14 h-7 text-red-500/80 shrink-0" viewBox="0 0 64 28" fill="none">
                  <path d="M2 20 C 16 18, 24 8, 38 14 C 48 18, 54 4, 62 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* 7. Total Visits */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                <Eye className="size-3.5 text-zinc-400" />
                <span>Total Visits</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  {overviewData?.metrics?.totalVisits?.toLocaleString() ?? 0}
                </span>
                <svg className="w-14 h-7 text-zinc-500/40 shrink-0" viewBox="0 0 64 28" fill="none">
                  <path d="M2 18 C 16 22, 28 12, 40 16 C 50 18, 56 8, 62 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Detailed Executive Analytics Insights Strip (4 KPI Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Insight 1: Sabse jyada traffic konse page pe aaya */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Most Visited Page
                </span>
                <TrendingUp className="size-4 text-emerald-400" />
              </div>
              <div className="mt-2.5">
                <p className="text-base font-bold text-white truncate">
                  {overviewData?.insights?.mostVisitedPage || "/services"}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  <span className="font-semibold text-emerald-400">{overviewData?.insights?.mostVisitedViews || 15} views</span> ({overviewData?.insights?.mostVisitedPercentage || 28}% of total traffic)
                </p>
              </div>
            </div>

            {/* Insight 2: Konse page pe sabse jyada der ruke (Longest Dwell Time) */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded">
                  Highest Dwell Time
                </span>
                <Clock className="size-4 text-amber-400" />
              </div>
              <div className="mt-2.5">
                <p className="text-base font-bold text-white truncate">
                  {overviewData?.insights?.longestDwellPage || "/"} (Homepage)
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Visitors stay longest: <span className="font-semibold text-amber-400">{overviewData?.insights?.longestDwellFormatted || "1m 55s"}</span> avg duration
                </p>
              </div>
            </div>

            {/* Insight 3: Average Session Time Across Site */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded">
                  Avg. Session Time
                </span>
                <Clock className="size-4 text-sky-400" />
              </div>
              <div className="mt-2.5">
                <p className="text-base font-bold text-white">
                  {overviewData?.metrics?.avgTimeOnSiteFormatted || "2m 14s"}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Average time across <span className="font-semibold text-sky-400">{overviewData?.insights?.totalVisitsCount || 33}</span> total visitor sessions
                </p>
              </div>
            </div>

            {/* Insight 4: Top Acquisition Channel */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400 bg-red-950/40 border border-red-500/30 px-2 py-0.5 rounded">
                  Primary Source
                </span>
                <Globe className="size-4 text-red-400" />
              </div>
              <div className="mt-2.5">
                <p className="text-base font-bold text-white">
                  {overviewData?.insights?.topTrafficSource || "Google / Direct"}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Accounts for <span className="font-semibold text-red-400">{overviewData?.insights?.topTrafficPercentage || 38}%</span> of all inbound traffic
                </p>
              </div>
            </div>
          </div>

          {/* Line Chart: Visitors Per Day */}
          <div className="bg-[#0c0e14] border border-white/[0.07] p-5 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-white">
                  Visitors per Day
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Daily unique visitors and pageviews (IST)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span className="size-2 rounded-full bg-red-500" /> Visitors
                </span>
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span className="size-2 rounded-full bg-zinc-400" /> Page Views
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              {mounted && overviewData?.visitorsPerDay && overviewData.visitorsPerDay.some((d: any) => (d.visitors || 0) > 0 || (d.pageViews || 0) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overviewData.visitorsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0e1017",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#ef4444" }}
                      activeDot={{ r: 5 }}
                      name="Visitors"
                    />
                    <Line
                      type="monotone"
                      dataKey="pageViews"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Page Views"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                /* Empty state matching the reference visual exactly */
                <div className="relative h-full flex flex-col justify-between py-2">
                  <div className="flex-1 flex flex-col justify-between">
                    {[5, 4, 3, 2, 1, 0].map((num) => (
                      <div key={num} className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-zinc-500 w-3 text-right">{num}</span>
                        <div className="flex-1 border-b border-dashed border-white/[0.05]" />
                      </div>
                    ))}
                  </div>

                  {/* Centered empty label with icon */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <svg className="size-5 text-zinc-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9" />
                      <path d="M13 17V5" />
                      <path d="M8 17v-3" />
                    </svg>
                    <span className="text-xs text-zinc-500">
                      {overviewLoading ? "Loading visitor metrics…" : "No visitor data in this date range yet."}
                    </span>
                  </div>

                  {/* X-axis date labels */}
                  <div className="flex justify-between pl-6 pr-2 pt-2 text-[11px] font-sans text-zinc-500">
                    {defaultEmptyDates.map((dt, idx) => (
                      <span key={idx}>{dt}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comprehensive Page Engagement & Dwell Time Analysis Table */}
          <div className="bg-[#0c0e14] border border-white/[0.07] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.06] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck2 className="size-4 text-red-500" />
                  <h3 className="text-sm font-semibold tracking-tight text-white">
                    Page Engagement &amp; Dwell Time Analysis
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Detailed analytics: Sabse jyada traffic konse page pe aaya aur visitors kis page pe kitni der ruke.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.08]">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Visitor Metrics
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-2.5 px-3">Page Path &amp; Section</th>
                    <th className="py-2.5 px-3">Traffic Share</th>
                    <th className="py-2.5 px-3 text-center">Page Views</th>
                    <th className="py-2.5 px-3 text-center">Unique Visitors</th>
                    <th className="py-2.5 px-3 text-center">Avg. Dwell Time</th>
                    <th className="py-2.5 px-3 text-right">Engagement Tag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {(overviewData?.pageEngagement || []).map((p: any, idx: number) => {
                    const isLongest = overviewData?.insights?.longestDwellPage === p.page;
                    const isMostVisited = overviewData?.insights?.mostVisitedPage === p.page;
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-semibold text-white block font-mono text-[12px]">{p.page}</span>
                          <span className="text-[11px] text-zinc-400 block mt-0.5">{p.name}</span>
                        </td>
                        <td className="py-3 px-3 w-40">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, Math.max(10, p.percentage || 15))}%` }}
                                className={`h-full rounded-full ${isMostVisited ? "bg-red-500" : isLongest ? "bg-amber-500" : "bg-zinc-400"}`}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-zinc-300 w-8 tabular-nums">{p.percentage}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold tabular-nums text-white">{p.views}</td>
                        <td className="py-3 px-3 text-center font-medium tabular-nums text-zinc-300">{p.visitors}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${isLongest
                            ? "bg-amber-950/40 text-amber-300 border border-amber-500/30"
                            : "bg-white/[0.04] text-zinc-200 border border-white/[0.06]"
                            }`}>
                            <Clock className="size-3" />
                            {p.avgTimeOnPageFormatted}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${isLongest
                            ? "bg-amber-950/40 text-amber-400 border border-amber-500/30"
                            : isMostVisited
                              ? "bg-red-950/40 text-red-400 border border-red-500/30"
                              : p.badge === "Lead Conversion"
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30"
                                : "bg-zinc-800/80 text-zinc-300 border border-white/10"
                            }`}>
                            {p.badge}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(!overviewData?.pageEngagement || overviewData.pageEngagement.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-zinc-500">
                        No page engagement data recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Pages, Top Sources, Top Cities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Pages */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 sm:p-5 rounded-xl shadow-sm flex flex-col min-h-[190px]">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck2 className="size-4 text-zinc-400" />
                <span className="text-xs font-semibold text-white">Top Pages</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 pb-2 border-b border-white/[0.05]">
                <span>Page</span>
                <span>Views · Avg Dwell</span>
              </div>
              <div className="flex-1 py-2">
                {overviewData?.topPages && overviewData.topPages.length > 0 ? (
                  <ul className="space-y-2">
                    {overviewData.topPages.map((item: any, idx: number) => (
                      <li key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate max-w-[160px] font-mono text-[11.5px]">{item.page || item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold tabular-nums text-white">{item.views || item.count}</span>
                          {item.avgTime && (
                            <span className="text-[10px] text-zinc-400 tabular-nums bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                              {item.avgTime}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex items-center justify-center py-6 text-xs text-zinc-500">
                    No page data yet.
                  </div>
                )}
              </div>
            </div>

            {/* Top Sources */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 sm:p-5 rounded-xl shadow-sm flex flex-col min-h-[190px]">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="size-4 text-zinc-400" />
                <span className="text-xs font-semibold text-white">Top Sources</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 pb-2 border-b border-white/[0.05]">
                <span>Source</span>
                <span>Visitors · Share</span>
              </div>
              <div className="flex-1 py-2">
                {overviewData?.topSources && overviewData.topSources.length > 0 ? (
                  <ul className="space-y-2">
                    {overviewData.topSources.map((item: any, idx: number) => (
                      <li key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate max-w-[160px] font-medium">{item.source || item.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold tabular-nums text-white">{item.visitors || item.count}</span>
                          {item.percentage && (
                            <span className="text-[10px] text-zinc-400 tabular-nums">
                              ({item.percentage}%)
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex items-center justify-center py-6 text-xs text-zinc-500">
                    No source data yet.
                  </div>
                )}
              </div>
            </div>

            {/* Top Cities */}
            <div className="bg-[#0c0e14] border border-white/[0.07] p-4 sm:p-5 rounded-xl shadow-sm flex flex-col min-h-[190px]">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="size-4 text-zinc-400" />
                <span className="text-xs font-semibold text-white">Top Cities</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 pb-2 border-b border-white/[0.05]">
                <span>City</span>
                <span>Visitors · Share</span>
              </div>
              <div className="flex-1 py-2">
                {overviewData?.topCities && overviewData.topCities.length > 0 ? (
                  <ul className="space-y-2">
                    {overviewData.topCities.map((item: any, idx: number) => (
                      <li key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate max-w-[160px]">{item.city || item.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold tabular-nums text-white">{item.visitors || item.count}</span>
                          {item.percentage && (
                            <span className="text-[10px] text-zinc-400 tabular-nums">
                              ({item.percentage}%)
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-full flex items-center justify-center py-6 text-xs text-zinc-500">
                    No city data yet.
                  </div>
                )}
              </div>
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
                        {ev.type === "assessment_click" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-semibold">
                            <ShieldCheck className="size-3 text-red-400" /> Clicked Request Assessment
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
                          <td className="py-3 px-4 text-red-400 font-medium">{v.onPage || "/"}</td>
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
                {((visitorsData?.pagination?.pages ?? visitorsData?.pages ?? 0) > 1) && (
                  <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      Page {visitorsData?.pagination?.page ?? visitorsData?.page ?? page} of {visitorsData?.pagination?.pages ?? visitorsData?.pages} ({visitorsData?.pagination?.total ?? visitorsData?.total} total)
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
                        disabled={page >= (visitorsData?.pagination?.pages ?? visitorsData?.pages ?? 1)}
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
        <div className="bg-[#0c0e14] rounded-xl border border-white/[0.07] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-4 text-red-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Pages Performance &amp; Dwell Time Analysis
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Views, unique readers and average reading/dwell time per page across all sessions.
              </p>
            </div>
            <span className="text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.08] px-2.5 py-1 rounded-md self-start sm:self-auto">
              Total {pagesData?.pages?.length || 0} Pages Tracked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Page Path</th>
                  <th className="py-3 px-4 text-center">Views</th>
                  <th className="py-3 px-4 text-center">Unique Visitors</th>
                  <th className="py-3 px-4 text-right">Avg. Dwell Time on Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(pagesData?.pages || []).map((p: any) => (
                  <tr key={p.page} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-white block font-mono text-[12.5px]">{p.page}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums text-white">{p.views?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center font-medium tabular-nums text-zinc-300">{p.visitors?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums bg-white/[0.04] text-zinc-200 border border-white/[0.06]">
                        <Clock className="size-3 text-zinc-400" />
                        {p.avgTimeOnPageFormatted}
                      </span>
                    </td>
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
        <div className="bg-[#0c0e14] rounded-xl border border-white/[0.07] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-red-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Traffic Sources &amp; Inbound Channels
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Source channels from referrer domains: Google, Direct, LinkedIn, X, Instagram.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Source Channel</th>
                  <th className="py-3 px-4 text-center">Visitors</th>
                  <th className="py-3 px-4 text-center">Pages / Visit</th>
                  <th className="py-3 px-4 text-center">Avg. Time on Site</th>
                  <th className="py-3 px-4 text-center">Forms Sent</th>
                  <th className="py-3 px-4 text-right">Apply Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(sourcesData?.sources || []).map((s: any) => (
                  <tr key={s.source} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{s.source}</td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums text-white">{s.visitors}</td>
                    <td className="py-3 px-4 text-center font-medium tabular-nums text-zinc-300">{s.pagesPerVisit}</td>
                    <td className="py-3 px-4 text-center text-zinc-300 tabular-nums">{s.avgTimeOnSiteFormatted}</td>
                    <td className="py-3 px-4 text-center font-bold tabular-nums text-red-400">{s.formsSent}</td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums text-red-400">{s.applyClicks}</td>
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
