"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Protected from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import { api } from "../../../lib/api.js";

function formatSeconds(secs) {
  if (!secs || secs <= 0) return "0s";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

function LiveWebDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [range, setRange] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Data states
  const [overview, setOverview] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [visitorsData, setVisitorsData] = useState(null);
  const [pagesData, setPagesData] = useState(null);
  const [sourcesData, setSourcesData] = useState(null);

  // Single visit detail
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [visitDetail, setVisitDetail] = useState(null);
  const [visitLoading, setVisitLoading] = useState(false);

  // Filters for Visitors tab
  const [filterCity, setFilterCity] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterReturning, setFilterReturning] = useState(false);
  const [filterFormSent, setFilterFormSent] = useState(false);
  const [page, setPage] = useState(1);

  // Loading & refresh
  const [loading, setLoading] = useState(false);
  const [lastLiveTime, setLastLiveTime] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Query string builder
  const buildQuery = useCallback(
    (extraTab) => {
      const params = new URLSearchParams();
      params.set("range", range);
      if (range === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }
      return params.toString();
    },
    [range, customFrom, customTo]
  );

  // Load Overview
  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/liveweb/overview?${buildQuery()}`);
      setOverview(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Load Live
  const loadLive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/api/liveweb/live");
      setLiveData(res);
      setLastLiveTime(Date.now());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Visitors
  const loadVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
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

      const res = await api(`/api/liveweb/visitors?${params.toString()}`);
      setVisitorsData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo, filterCity, filterSource, filterReturning, filterFormSent, page]);

  // Load Visit Detail
  const loadVisitDetail = useCallback(async (id) => {
    setVisitLoading(true);
    try {
      const res = await api(`/api/liveweb/visit/${encodeURIComponent(id)}`);
      setVisitDetail(res);
    } catch (err) {
      console.error(err);
    } finally {
      setVisitLoading(false);
    }
  }, []);

  // Load Pages
  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/liveweb/pages?${buildQuery()}`);
      setPagesData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Load Sources
  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/liveweb/sources?${buildQuery()}`);
      setSourcesData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Export CSV
  const handleExport = () => {
    let view = "visitors";
    if (activeTab === "pages") view = "pages";
    else if (activeTab === "sources") view = "sources";

    const params = new URLSearchParams();
    params.set("range", range);
    params.set("view", view);
    if (range === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    window.location.href = `/api/liveweb/export?${params.toString()}`;
  };

  // Auto-refresh timer for Live tab
  useEffect(() => {
    if (activeTab !== "live") return;
    loadLive();
    const interval = setInterval(loadLive, 30000);
    return () => clearInterval(interval);
  }, [activeTab, loadLive]);

  // Second tick for Live updated status
  useEffect(() => {
    if (activeTab !== "live") return;
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastLiveTime) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [activeTab, lastLiveTime]);

  // Tab & range switch trigger
  useEffect(() => {
    if (activeTab === "overview") loadOverview();
    else if (activeTab === "visitors" && !selectedVisitId) loadVisitors();
    else if (activeTab === "pages") loadPages();
    else if (activeTab === "sources") loadSources();
  }, [activeTab, range, customFrom, customTo, loadOverview, loadVisitors, loadPages, loadSources, selectedVisitId]);

  // Single visit detail trigger
  useEffect(() => {
    if (selectedVisitId) loadVisitDetail(selectedVisitId);
    else setVisitDetail(null);
  }, [selectedVisitId, loadVisitDetail]);

  const openVisit = (id) => {
    setSelectedVisitId(id);
    setActiveTab("visitors");
  };

  // SVG Chart points calculation for Visitors Per Day
  const chartPoints = useMemo(() => {
    const list = overview?.visitorsPerDay || [];
    if (!list.length) return null;
    const maxVal = Math.max(...list.map((d) => Math.max(d.visitors || 0, d.pageViews || 0)), 5);
    const width = 640;
    const height = 180;
    const padding = 24;

    const step = list.length > 1 ? (width - padding * 2) / (list.length - 1) : 0;

    const visitorPts = list.map((d, i) => {
      const x = padding + i * step;
      const y = height - padding - ((d.visitors || 0) / maxVal) * (height - padding * 2);
      return { x, y, ...d };
    });

    const pageViewPts = list.map((d, i) => {
      const x = padding + i * step;
      const y = height - padding - ((d.pageViews || 0) / maxVal) * (height - padding * 2);
      return { x, y, ...d };
    });

    const vPath = visitorPts.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
    const pvPath = pageViewPts.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");

    return { visitorPts, pageViewPts, vPath, pvPath, width, height, maxVal };
  }, [overview]);

  return (
    <DeskShell
      title="LiveWeb Analytics"
      subtitle="Real-time visitors, channels and page engagement on apthex.com"
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)", borderRadius: "999px", padding: "3px" }}>
            {["today", "7d", "30d", "custom"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: "0.75rem",
                  fontWeight: range === r ? 700 : 500,
                  background: range === r ? "var(--red)" : "transparent",
                  color: range === r ? "#fff" : "var(--text-soft)",
                  border: 0,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "Custom"}
              </button>
            ))}
          </div>

          {range === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ background: "#14141a", border: "1px solid var(--line)", color: "var(--text)", padding: "4px 8px", borderRadius: "8px", fontSize: "0.75rem" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ background: "#14141a", border: "1px solid var(--line)", color: "var(--text)", padding: "4px 8px", borderRadius: "8px", fontSize: "0.75rem" }}
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={handleExport}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Icon name="file" size={14} /> Export CSV
          </button>
        </div>
      }
    >
      {/* LiveWeb Tab Navigation Bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
        {[
          { id: "overview", label: "Overview", icon: "home" },
          { id: "live", label: "Live Active", icon: "eye", pulse: liveData?.onSiteNow > 0 },
          { id: "visitors", label: "Visitors", icon: "users" },
          { id: "pages", label: "Pages", icon: "list" },
          { id: "sources", label: "Sources", icon: "layers" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedVisitId(null);
                setActiveTab(tab.id);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: active ? 700 : 500,
                background: active ? "rgba(225, 29, 46, 0.12)" : "rgba(255,255,255,0.03)",
                color: active ? "var(--red)" : "var(--text-soft)",
                border: active ? "1px solid rgba(225, 29, 46, 0.3)" : "1px solid var(--line)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon name={tab.icon} size={15} />
              <span>{tab.label}</span>
              {tab.pulse && (
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10b981",
                    boxShadow: "0 0 8px #10b981",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 1. OVERVIEW SCREEN */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Live Visitor Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(20, 20, 26, 0.8))",
              border: "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 12px #10b981",
                }}
              />
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#10b981", fontWeight: 700 }}>
                  On site now (Live)
                </span>
                <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, fontFamily: "var(--font-mono)", color: "#fff" }}>
                  {overview?.onSiteNow ?? 0}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setActiveTab("live")}
              style={{ color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}
            >
              View live users →
            </button>
          </div>

          {/* 6 Metric Cards */}
          <div className="desk-summary" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
            <div className="summary-card">
              <div className="summary-card-copy">
                <span className="small-lbl">Visitors</span>
                <b style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)" }}>
                  {overview?.metrics?.visitors?.toLocaleString() ?? 0}
                </b>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-card-copy">
                <span className="small-lbl">Page Views</span>
                <b style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)" }}>
                  {overview?.metrics?.pageViews?.toLocaleString() ?? 0}
                </b>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-card-copy">
                <span className="small-lbl">Avg. Time on Site</span>
                <b style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)" }}>
                  {overview?.metrics?.avgTimeOnSiteFormatted ?? "0s"}
                </b>
              </div>
            </div>

            <div className="summary-card" style={{ borderColor: "rgba(225, 29, 46, 0.3)" }}>
              <div className="summary-card-copy">
                <span className="small-lbl" style={{ color: "var(--red)" }}>Forms Sent</span>
                <b style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)", color: "var(--red)" }}>
                  {overview?.metrics?.formsSent ?? 0}
                </b>
              </div>
            </div>

            <div className="summary-card" style={{ borderColor: "rgba(225, 29, 46, 0.3)" }}>
              <div className="summary-card-copy">
                <span className="small-lbl" style={{ color: "var(--red)" }}>Apply Clicks</span>
                <b style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)", color: "var(--red)" }}>
                  {overview?.metrics?.applyClicks ?? 0}
                </b>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-card-copy">
                <span className="small-lbl">Total Visits</span>
                <b style={{ fontSize: "1.5rem", fontFamily: "var(--font-mono)" }}>
                  {overview?.metrics?.totalVisits?.toLocaleString() ?? 0}
                </b>
              </div>
            </div>
          </div>

          {/* Visitors Per Day SVG Chart */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Visitors Per Day</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Daily unique visitors (solid line) &amp; page views (dashed) in IST</span>
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "0.75rem" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "3px", background: "var(--text)" }} /> Visitors
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "12px", height: "3px", background: "var(--red)" }} /> Page Views
                </span>
              </div>
            </div>

            {chartPoints ? (
              <div style={{ width: "100%", overflowX: "auto" }}>
                <svg viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`} style={{ width: "100%", height: "200px" }}>
                  <line x1="24" y1="156" x2={chartPoints.width - 24} y2="156" stroke="rgba(255,255,255,0.1)" />
                  <line x1="24" y1="90" x2={chartPoints.width - 24} y2="90" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="24" y1="24" x2={chartPoints.width - 24} y2="24" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

                  {/* Page Views Path (Dashed Red) */}
                  <path d={chartPoints.pvPath} fill="none" stroke="var(--red)" strokeWidth="2" strokeDasharray="4 4" opacity="0.8" />

                  {/* Visitors Path (Solid White) */}
                  <path d={chartPoints.vPath} fill="none" stroke="#fff" strokeWidth="2.5" />

                  {/* Points */}
                  {chartPoints.visitorPts.map((pt, i) => (
                    <g key={i}>
                      <circle cx={pt.x} cy={pt.y} r="4" fill="#fff" stroke="#121215" strokeWidth="2" />
                      <text x={pt.x} y="174" fontSize="10" fill="var(--muted)" textAnchor="middle" fontFamily="var(--font-mono)">
                        {pt.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                No daily visitor data recorded in this range yet.
              </div>
            )}
          </div>

          {/* 3 Short Lists: Top Pages, Top Sources, Top Cities */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
            {/* Top Pages */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid var(--line)", pb: "8px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Top Pages</span>
                <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Views</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {(overview?.topPages || []).map((p, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                    <span style={{ color: "var(--text-soft)" }}>{p.page}</span>
                    <span style={{ fontWeight: 700, color: "#fff" }}>{p.views}</span>
                  </li>
                ))}
                {(!overview?.topPages || overview.topPages.length === 0) && (
                  <li style={{ color: "var(--muted)", fontSize: "0.75rem" }}>No page views recorded yet.</li>
                )}
              </ul>
            </div>

            {/* Top Sources */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid var(--line)", pb: "8px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Top Sources</span>
                <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Visitors</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {(overview?.topSources || []).map((s, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "var(--text-soft)" }}>{s.source}</span>
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "#fff" }}>{s.visitors}</span>
                  </li>
                ))}
                {(!overview?.topSources || overview.topSources.length === 0) && (
                  <li style={{ color: "var(--muted)", fontSize: "0.75rem" }}>No sources recorded yet.</li>
                )}
              </ul>
            </div>

            {/* Top Cities */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid var(--line)", pb: "8px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Top Cities</span>
                <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Visitors</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {(overview?.topCities || []).map((c, i) => (
                  <li key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "var(--text-soft)" }}>{c.city}</span>
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "#fff" }}>{c.visitors}</span>
                  </li>
                ))}
                {(!overview?.topCities || overview.topCities.length === 0) && (
                  <li style={{ color: "var(--muted)", fontSize: "0.75rem" }}>No city data recorded yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. LIVE ACTIVE VISITORS SCREEN */}
      {activeTab === "live" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
              <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                On site now: <b style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}>{liveData?.onSiteNow ?? 0}</b>
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>· Active in last 5 minutes</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.75rem", color: "var(--muted)" }}>
              <span>Updated {secondsAgo}s ago</span>
              <span className="badge" style={{ color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}>Auto-refresh on (30s)</span>
              <button type="button" className="btn btn-ghost btn-small" onClick={loadLive} style={{ padding: "4px 8px" }}>
                <Icon name="refresh" size={13} />
              </button>
            </div>
          </div>

          <div className="table-card">
            <table className="desk-table">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Location</th>
                  <th>Device</th>
                  <th>On Page</th>
                  <th>Came From</th>
                  <th style={{ textAlign: "center" }}>Pages</th>
                  <th style={{ textAlign: "right" }}>Time on Site</th>
                </tr>
              </thead>
              <tbody>
                {(liveData?.visits || []).map((v) => (
                  <tr key={v.id} onClick={() => openVisit(v.id)} style={{ cursor: "pointer" }}>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff" }}>{v.ip}</td>
                    <td>{v.location}</td>
                    <td>{v.device}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--red)" }}>{v.onPage}</td>
                    <td>{v.cameFrom}</td>
                    <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{v.pages}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{v.timeOnSiteFormatted}</td>
                  </tr>
                ))}
                {(!liveData?.visits || liveData.visits.length === 0) && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                      No active visitors on apthex.com right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. VISITORS & SINGLE VISIT TIMELINE */}
      {activeTab === "visitors" && (
        <div>
          {selectedVisitId && visitDetail ? (
            /* Single Visit Timeline View */
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--line)", paddingBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setSelectedVisitId(null)}>
                    ‹ Back to list
                  </button>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-mono)" }}>
                    Visit · {visitDetail.firstSeenFormatted}
                  </h3>
                </div>
                <span className="badge">Total Time: {visitDetail.timeOnSiteFormatted}</span>
              </div>

              {/* Meta Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "12px", border: "1px solid var(--line)", marginBottom: "20px" }}>
                <div>
                  <span className="small-lbl">WHO</span>
                  <b style={{ display: "block", fontSize: "0.85rem", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                    {visitDetail.ip} · {visitDetail.location}
                  </b>
                </div>
                <div>
                  <span className="small-lbl">DEVICE</span>
                  <b style={{ display: "block", fontSize: "0.85rem", marginTop: "4px" }}>{visitDetail.device}</b>
                </div>
                <div>
                  <span className="small-lbl">CAME FROM</span>
                  <b style={{ display: "block", fontSize: "0.85rem", marginTop: "4px" }}>{visitDetail.source}</b>
                </div>
                <div>
                  <span className="small-lbl">HISTORY</span>
                  <b style={{ display: "block", fontSize: "0.85rem", marginTop: "4px" }}>
                    {visitDetail.visitCount === 1 ? "1st visit" : `${visitDetail.visitCount}th visit`}
                  </b>
                </div>
              </div>

              {/* Chronological List of Pages */}
              <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                Pages &amp; Actions Opened in Order
              </h4>

              <div className="table-card">
                <table className="desk-table">
                  <thead>
                    <tr>
                      <th style={{ width: "120px" }}>Time (IST)</th>
                      <th>Page / Action</th>
                      <th style={{ textAlign: "right", width: "140px" }}>Time on Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(visitDetail.timeline || []).map((item, idx) => {
                      const isAction = item.type === "contact_form_submit" || item.type === "apply_click";
                      return (
                        <tr
                          key={idx}
                          style={
                            isAction
                              ? { background: "rgba(225, 29, 46, 0.22)", borderLeft: "4px solid var(--red)" }
                              : {}
                          }
                        >
                          <td style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{item.timeStr}</td>
                          <td style={{ fontWeight: isAction ? 700 : 500, color: isAction ? "#fff" : "var(--text)" }}>
                            {item.type === "contact_form_submit" && "✉ Contact form sent"}
                            {item.type === "apply_click" && `⚡ Apply clicked: ${item.role || "Role"}`}
                            {item.type === "pageview" && <span style={{ fontFamily: "var(--font-mono)" }}>{item.page}</span>}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                            {isAction ? "—" : item.timeOnPageFormatted}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Visitors List */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Filter Row */}
              <div className="filter-card" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", padding: "14px 18px" }}>
                <span className="small-lbl">Filters:</span>
                <input
                  type="text"
                  placeholder="Filter by city..."
                  value={filterCity}
                  onChange={(e) => {
                    setFilterCity(e.target.value);
                    setPage(1);
                  }}
                  style={{ background: "#14141a", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem" }}
                />

                <select
                  value={filterSource}
                  onChange={(e) => {
                    setFilterSource(e.target.value);
                    setPage(1);
                  }}
                  style={{ background: "#14141a", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem" }}
                >
                  <option value="">All Sources</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Google">Google</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Tally">Tally</option>
                  <option value="X">X</option>
                  <option value="Direct">Direct</option>
                </select>

                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--text-soft)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={filterReturning}
                    onChange={(e) => {
                      setFilterReturning(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Returning only
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--text-soft)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={filterFormSent}
                    onChange={(e) => {
                      setFilterFormSent(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Form sent only
                </label>
              </div>

              {/* Table */}
              <div className="table-card">
                <table className="desk-table">
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>Location</th>
                      <th>Device</th>
                      <th>Source</th>
                      <th>Current Page</th>
                      <th style={{ textAlign: "center" }}>Pages</th>
                      <th style={{ textAlign: "right" }}>Time</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(visitorsData?.visits || []).map((v) => (
                      <tr key={v.id} onClick={() => openVisit(v.id)} style={{ cursor: "pointer" }}>
                        <td>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff" }}>{v.ip}</span>
                          {v.isReturning && (
                            <span className="badge" style={{ marginLeft: "8px", fontSize: "0.6rem" }}>
                              {v.visitCount} visits
                            </span>
                          )}
                        </td>
                        <td>{v.location}</td>
                        <td>{v.device}</td>
                        <td style={{ fontWeight: 600 }}>{v.source}</td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "var(--red)" }}>{v.currentPage}</td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{v.pages}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{v.timeOnSiteFormatted}</td>
                        <td style={{ textAlign: "center" }}>
                          {v.formSent && <span className="badge" style={{ color: "var(--red)", borderColor: "var(--red)" }}>Form</span>}
                          {v.applyClicked && <span className="badge" style={{ color: "#fff", background: "var(--red)" }}>Apply</span>}
                          {!v.formSent && !v.applyClicked && <span style={{ color: "var(--muted)" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                    {(!visitorsData?.visits || visitorsData.visits.length === 0) && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                          No visitor sessions found in this date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. PAGES SCREEN */}
      {activeTab === "pages" && (
        <div className="table-card">
          <table className="desk-table">
            <thead>
              <tr>
                <th>Page Path</th>
                <th style={{ textAlign: "center" }}>Views</th>
                <th style={{ textAlign: "center" }}>Unique Readers</th>
                <th style={{ textAlign: "right" }}>Avg. Time on Page</th>
              </tr>
            </thead>
            <tbody>
              {(pagesData?.pages || []).map((p) => (
                <tr key={p.page}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#fff" }}>{p.page}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{p.views?.toLocaleString()}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{p.visitors?.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.avgTimeOnPageFormatted}</td>
                </tr>
              ))}
              {(!pagesData?.pages || pagesData.pages.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                    No pages recorded in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. SOURCES SCREEN */}
      {activeTab === "sources" && (
        <div className="table-card">
          <table className="desk-table">
            <thead>
              <tr>
                <th>Source</th>
                <th style={{ textAlign: "center" }}>Visitors</th>
                <th style={{ textAlign: "center" }}>Pages / Visit</th>
                <th style={{ textAlign: "center" }}>Avg. Time on Site</th>
                <th style={{ textAlign: "center" }}>Forms Sent</th>
                <th style={{ textAlign: "right" }}>Apply Clicks</th>
              </tr>
            </thead>
            <tbody>
              {(sourcesData?.sources || []).map((s) => (
                <tr key={s.source}>
                  <td style={{ fontWeight: 700, color: "#fff" }}>{s.source}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{s.visitors}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{s.pagesPerVisit}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)" }}>{s.avgTimeOnSiteFormatted}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--red)", fontWeight: 700 }}>{s.formsSent}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--red)", fontWeight: 700 }}>{s.applyClicks}</td>
                </tr>
              ))}
              {(!sourcesData?.sources || sourcesData.sources.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                    No traffic sources recorded in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </DeskShell>
  );
}

export default function LiveWebPage() {
  return (
    <Protected>
      <LiveWebDashboard />
    </Protected>
  );
}
