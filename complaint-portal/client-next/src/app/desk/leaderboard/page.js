"use client";

import { useCallback, useEffect, useState } from "react";
import Protected from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import Spinner from "../../../components/Spinner.jsx";
import { api } from "../../../lib/api.js";

function Leaderboard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    return api("/api/stats/leaderboard")
      .then((data) => {
        setRows(data.leaderboard || []);
        setUpdatedAt(new Date());
      })
      .catch((requestError) => setError(requestError.message || "Could not load the leaderboard."));
  }, []);

  // Live leaderboard: har 15 second me khud refresh (tab chhupa ho to skip).
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function refreshManually() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const max = rows && rows.length ? Math.max(...rows.map((row) => row.total)) : 0;

  // Search sirf client-side: ref ID (APT-101) ya college name se filter.
  const needle = query.trim().toLowerCase();
  const visible = rows
    ? rows.filter((row) => !needle || row.code.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle))
    : [];

  return (
    <DeskShell
      title="College Leaderboard"
      subtitle="Every generated ref ID with its college and complaint count — updates every 15 seconds."
      actions={
        <div className="row">
          {updatedAt && <span className="small muted">Updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button type="button" className="btn btn-ghost btn-small" onClick={refreshManually} disabled={refreshing}>
            <Icon name="refresh" size={15} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="card center-state-inline">
          <span className="icon-tile icon-tile-red"><Icon name="alert" size={26} /></span>
          <p className="error-text">{error}</p>
        </div>
      )}

      {!rows && !error && (
        <div className="card table-card">
          <div className="inline-loading"><Spinner label="Loading leaderboard…" /></div>
        </div>
      )}

      {rows && (
        <div className="card lb-search">
          <span className="icon-tile icon-tile-small"><Icon name="search" size={16} /></span>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ref ID (APT-101) or college name…"
            aria-label="Search the leaderboard by ref ID or college name"
          />
          {query && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="card empty-state">
          <span className="icon-tile"><Icon name="chart" size={26} /></span>
          <h2>No ref IDs yet</h2>
          <p className="muted">Generate the first institute ref ID under "Institute ref IDs" — every college then appears here with its count.</p>
        </div>
      )}

      {rows && rows.length > 0 && visible.length === 0 && (
        <div className="card empty-state">
          <span className="icon-tile"><Icon name="search" size={26} /></span>
          <h2>No matches</h2>
          <p className="muted">Nothing on the board matches "{query.trim()}" — try a different ref ID or college name.</p>
        </div>
      )}

      {rows && visible.length > 0 && (
        <div className="lb-rows">
          {visible.map((row) => (
            <div className="lb-row" key={row.code}>
              <span className={`lb-rank${row.rank === 1 ? " lb-rank-first" : ""}`}>#{row.rank}</span>
              <div className="lb-info">
                <strong>{row.name}</strong>
                <span className="lb-code mono">{row.code}</span>
                <div className="lb-bar" role="presentation">
                  <span style={{ width: `${max ? Math.max(4, Math.round((row.total / max) * 100)) : 4}%` }} />
                </div>
                <span className="lb-meta">
                  {row.in_process} in progress · {row.completed} resolved
                </span>
              </div>
              <div className="lb-count">
                <strong>{row.total}</strong>
                <span>{row.total === 1 ? "complaint" : "complaints"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DeskShell>
  );
}

export default function LeaderboardPage() {
  return <Protected><Leaderboard /></Protected>;
}
