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

  return (
    <DeskShell
      title="College Leaderboard"
      subtitle="Complaints received from each college — updates every 15 seconds."
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

      {rows && rows.length === 0 && (
        <div className="card empty-state">
          <span className="icon-tile"><Icon name="chart" size={26} /></span>
          <h2>No complaints yet</h2>
          <p className="muted">As soon as students start submitting, each college shows up here with its count.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="lb-rows">
          {rows.map((row) => (
            <div className="lb-row" key={row.code}>
              <span className={`lb-rank${row.rank === 1 ? " lb-rank-first" : ""}`}>#{row.rank}</span>
              <div className="lb-info">
                <strong>{row.name}</strong>
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
