"use client";

import { useCallback, useEffect, useState } from "react";
import Protected, { useAuth } from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import Spinner from "../../../components/Spinner.jsx";
import { api } from "../../../lib/api.js";
import { formatDateTime } from "../../../lib/format.js";

const EMPTY = { action: "", entity: "", outcome: "" };

function AuditView() {
  const { member } = useAuth();
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filters.action) params.set("action", filters.action.trim());
    if (filters.entity) params.set("entity", filters.entity.trim());
    if (filters.outcome) params.set("outcome", filters.outcome);
    try {
      setData(await api(`/api/staff/audit?${params.toString()}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    if (member.role === "owner") load();
  }, [load, member.role]);

  if (member.role !== "owner") {
    return (
      <DeskShell title="Audit log">
        <div className="card empty-state">
          <span className="icon-tile icon-tile-amber"><Icon name="lock" size={24} /></span>
          <h2>Owner access required</h2>
          <p>The audit log is restricted to active owners.</p>
        </div>
      </DeskShell>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <DeskShell
      title="Security audit log"
      subtitle="Append-only record of staff authentication, case access and administrative actions."
      actions={
        <button type="button" className="btn btn-secondary btn-small" onClick={load} disabled={loading}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
      }
    >
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}

      <form
        className="card filter-card"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilters({ ...draft });
        }}
      >
        <div className="filter-grid filter-grid-three">
          <label className="field">
            <span className="field-label">Action</span>
            <input className="input" value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} placeholder="e.g. staff_login" />
          </label>
          <label className="field">
            <span className="field-label">Entity</span>
            <input className="input" value={draft.entity} onChange={(event) => setDraft({ ...draft, entity: event.target.value })} placeholder="e.g. complaint" />
          </label>
          <label className="field">
            <span className="field-label">Outcome</span>
            <select className="select" value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}>
              <option value="">All outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </label>
        </div>
        <div className="between filter-actions">
          <span className="small muted">IP addresses are stored only as salted hashes.</span>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => { setDraft(EMPTY); setFilters(EMPTY); setPage(1); }}>Clear</button>
            <button type="submit" className="btn btn-secondary btn-small"><Icon name="search" size={15} /> Apply</button>
          </div>
        </div>
      </form>

      <div className="card table-card">
        {loading && !data ? (
          <Spinner label="Loading audit events…" />
        ) : !data?.items?.length ? (
          <div className="empty-state"><h2>No audit events found</h2><p>Try a different filter.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table audit-table">
              <thead>
                <tr><th>Time</th><th>Member</th><th>Action</th><th>Entity</th><th>Outcome</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {data.items.map((event) => (
                  <tr key={event.id}>
                    <td className="nowrap">{formatDateTime(event.occurred_at)}</td>
                    <td>{event.member ? <>{event.member.name}<div className="small muted">{event.member.email}</div></> : <span className="muted">Public / system</span>}</td>
                    <td><code className="inline-code">{event.action}</code></td>
                    <td>
                      <span>{event.entity}</span>
                      {event.entity_id && <div className="small muted mono cell-clamp" title={event.entity_id}>{event.entity_id}</div>}
                    </td>
                    <td><span className={`badge ${event.outcome === "failure" ? "badge-spam" : "status-completed"}`}>{event.outcome}</span></td>
                    <td><span className="cell-clamp detail-cell" title={event.detail || ""}>{event.detail || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="pagination between">
            <span className="small muted">Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}</span>
            <div className="row">
              <button type="button" className="btn btn-ghost btn-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span className="small">Page {data.page} of {totalPages}</span>
              <button type="button" className="btn btn-ghost btn-small" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </DeskShell>
  );
}

export default function AuditPage() {
  return <Protected><AuditView /></Protected>;
}
