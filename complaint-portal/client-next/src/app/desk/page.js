"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Protected, { useAuth } from "../../components/Protected.jsx";
import DeskShell from "../../components/DeskShell.jsx";
import Icon from "../../components/Icon.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { api } from "../../lib/api.js";
import { formatDateTime } from "../../lib/format.js";
import { CATEGORY_META, URGENT_CATEGORY } from "../../i18n/index.js";

const EMPTY_FILTERS = {
  institute_code: "",
  category: "",
  status: "",
  search: "",
  urgent: false,
  spam: "false",
};

function Dashboard() {
  const router = useRouter();
  const { member } = useAuth();
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  // Teachers land here too — the server forces their list to their own
  // college, so no redirect is needed anymore.
  const isOwner = member?.role === "owner";

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.institute_code) params.set("institute_code", filters.institute_code.trim().toUpperCase());
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search.trim());
    if (filters.urgent) params.set("urgent", "true");
    if (filters.spam !== "false") params.set("spam", filters.spam);
    params.set("page", String(page));
    params.set("limit", "25");
    return params.toString();
  }, [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api(`/api/complaints?${query}`);
      setData(result);
      setUpdatedAt(new Date());
    } catch (requestError) {
      if (requestError.status === 401) return;
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters(event) {
    event?.preventDefault();
    setPage(1);
    setFilters({ ...draft });
  }

  function resetFilters() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const summary = data?.summary || { total: 0, urgent: 0, in_process: 0, completed: 0 };
  const items = data?.items || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <DeskShell
      title={isOwner ? "Case overview" : "College complaints"}
      subtitle={
        isOwner
          ? "Every report submitted through the public portal, private to authorised APTHEX staff."
          : `Only complaints reported against your college${member?.institute_code ? ` (${member.institute_code})` : ""} appear here — read-only view.`
      }
      actions={
        <>
          <button type="button" className="btn btn-secondary btn-small" onClick={load} disabled={loading}>
            <Icon name="refresh" size={16} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
          {isOwner && (
            <Link href="/desk/stats" className="btn btn-ghost btn-small">
              <Icon name="chart" size={16} /> Institute reporting
            </Link>
          )}
        </>
      }
    >
      <div className="stat-grid">
        <article className="stat-card">
          <span className="stat-icon"><Icon name="list" size={20} /></span>
          <div><span>All cases</span><strong>{summary.total}</strong></div>
        </article>
        <article className="stat-card stat-urgent">
          <span className="stat-icon"><Icon name="alert" size={20} /></span>
          <div><span>Urgent, open</span><strong>{summary.urgent}</strong></div>
        </article>
        <article className="stat-card">
          <span className="stat-icon"><Icon name="clock" size={20} /></span>
          <div><span>In process</span><strong>{summary.in_process}</strong></div>
        </article>
        <article className="stat-card stat-complete">
          <span className="stat-icon"><Icon name="check" size={20} /></span>
          <div><span>Completed</span><strong>{summary.completed}</strong></div>
        </article>
      </div>

      <form className="card filter-card" onSubmit={applyFilters}>
        <div className="filter-grid">
          <label className="field">
            <span className="field-label">Search reference</span>
            <input className="input" value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value.toUpperCase() })} placeholder="APX-2601-ABC234" maxLength={16} />
          </label>
          {isOwner && (
            <label className="field">
              <span className="field-label">Institute code</span>
              <input className="input" value={draft.institute_code} onChange={(event) => setDraft({ ...draft, institute_code: event.target.value.toUpperCase() })} placeholder="SCHOOL01" maxLength={32} />
            </label>
          )}
          <label className="field">
            <span className="field-label">Category</span>
            <select className="select" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              <option value="">All categories</option>
              {CATEGORY_META.map((category) => <option key={category.value} value={category.value}>{category.value}</option>)}
              <option value={URGENT_CATEGORY}>{URGENT_CATEGORY}</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select className="select" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              <option value="">All statuses</option>
              <option value="in_process">In process</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          {isOwner && (
            <label className="field">
              <span className="field-label">Spam</span>
              <select className="select" value={draft.spam} onChange={(event) => setDraft({ ...draft, spam: event.target.value })}>
                <option value="false">Visible only</option>
                <option value="true">Spam only</option>
                <option value="all">Include spam</option>
              </select>
            </label>
          )}
          <label className="checkbox-field">
            <input type="checkbox" checked={draft.urgent} onChange={(event) => setDraft({ ...draft, urgent: event.target.checked })} />
            <span>Urgent only</span>
          </label>
        </div>
        <div className="between filter-actions">
          <span className="small muted">
            {updatedAt ? `Updated ${formatDateTime(updatedAt)}` : "Loading cases…"}
          </span>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-small" onClick={resetFilters}>Clear</button>
            <button type="submit" className="btn btn-secondary btn-small"><Icon name="search" size={15} /> Apply filters</button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}

      <div className="card table-card">
        {loading && !data ? (
          <div className="center-state center-state-inline"><span className="spinner" /><p>Loading cases…</p></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="icon-tile"><Icon name="search" size={24} /></span>
            <h2>No cases match these filters</h2>
            <p>Try clearing the filters or changing the reference search.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Institute</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Received</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.ref_id}
                    className={item.urgent ? "row-urgent" : undefined}
                    onClick={() => router.push(`/desk/complaint/${item.ref_id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/desk/complaint/${item.ref_id}`);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td>
                      <span className="ref-cell">{item.ref_id}</span>
                      {item.urgent && <span className="badge badge-urgent">Urgent</span>}
                    </td>
                    <td><span className="mono">{item.institute_code}</span></td>
                    <td><span className="cell-clamp">{item.category}</span></td>
                    <td><StatusBadge status={item.status} spam={item.flagged_spam} /></td>
                    <td>{item.assigned_to?.name || <span className="muted">Unassigned</span>}</td>
                    <td className="nowrap">{formatDateTime(item.created_at)}</td>
                    <td><Icon name="arrowRight" size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && items.length > 0 && (
          <div className="pagination between">
            <span className="small muted">
              Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
            </span>
            <div className="row">
              <button type="button" className="btn btn-ghost btn-small" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <Icon name="arrowLeft" size={15} /> Previous
              </button>
              <span className="small">Page {data.page} of {totalPages}</span>
              <button type="button" className="btn btn-ghost btn-small" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                Next <Icon name="arrowRight" size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </DeskShell>
  );
}

export default function DeskPage() {
  return <Protected><Dashboard /></Protected>;
}
