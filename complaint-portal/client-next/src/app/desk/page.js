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

  // Auto-detect institute for case_team (staff) members
  // Teachers/admins see only their institute's complaints
  const isOwner = member?.role === "owner";
  const isStaff = member?.role === "case_team";
  const staffInstituteCode = isStaff ? member?.institute_code || "" : "";

  // Construct query string from filters
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

  // Auto-set institute code for staff (case_team) members from their record
  useEffect(() => {
    if (isStaff && staffInstituteCode && !filters.institute_code) {
      setDraft((prev) => ({ ...prev, institute_code: staffInstituteCode }));
      setFilters((prev) => ({ ...prev, institute_code: staffInstituteCode }));
    }
  }, [isStaff, staffInstituteCode, filters.institute_code]);

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

  const summary = data?.summary || { total: 0, urgent: 0, in_process: 0, completed: 0, by_category: {} };
  const byCategory = summary.by_category || {};
  const items = data?.items || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <DeskShell
      title={isOwner ? "Case Overview" : "College Complaints Metrics"}
      subtitle={
        isOwner
          ? "Every report submitted through the public portal, private to authorised APTHEX staff."
          : `Aggregate complaint counts and category metrics for ${filters.institute_code || staffInstituteCode || "your institute"} — student privacy protected.`
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
      <div className="desk-summary">
        <article className="summary-card summary-card-total">
          <span className="summary-card-icon"><Icon name="layers" size={18} /></span>
          <div className="summary-card-copy">
            <span className="summary-card-value">{summary.total}</span>
            <span className="summary-card-label">Total cases</span>
          </div>
          <svg className="summary-wave" viewBox="0 0 260 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 68c30-10 52 6 86-2s58-20 92-14 48 16 82 10v18H0Z" fill="currentColor" />
          </svg>
        </article>
        <article className="summary-card summary-card-urgent">
          <span className="summary-card-icon"><Icon name="alert" size={18} /></span>
          <div className="summary-card-copy">
            <span className="summary-card-value">{summary.urgent}</span>
            <span className="summary-card-label">Urgent open</span>
          </div>
          <svg className="summary-wave" viewBox="0 0 260 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 70c32-12 58 2 92-6s54-18 90-12 46 14 78 8v20H0Z" fill="currentColor" />
          </svg>
        </article>
        <article className="summary-card summary-card-process">
          <span className="summary-card-icon"><Icon name="clock" size={18} /></span>
          <div className="summary-card-copy">
            <span className="summary-card-value">{summary.in_process}</span>
            <span className="summary-card-label">In process</span>
          </div>
          <svg className="summary-wave" viewBox="0 0 260 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 66c30-8 56 8 90 0s58-20 94-14 44 18 76 12v16H0Z" fill="currentColor" />
          </svg>
        </article>
        <article className="summary-card summary-card-done">
          <span className="summary-card-icon"><Icon name="check" size={18} /></span>
          <div className="summary-card-copy">
            <span className="summary-card-value">{summary.completed}</span>
            <span className="summary-card-label">Completed</span>
          </div>
          <svg className="summary-wave" viewBox="0 0 260 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 69c32-11 56 4 88-4s56-20 92-14 46 18 80 12v17H0Z" fill="currentColor" />
          </svg>
        </article>
      </div>

      <form className="card filter-card desk-filter" onSubmit={applyFilters}>
        <div className="desk-filter-head">
          <span className="filter-title">
            <Icon name="filter" size={15} /> {isOwner ? "Filter complaints" : "View complaints by institute code"}
          </span>
          <div className="desk-filter-head-right">
            {isOwner && (
              <label className="checkbox-field desk-urgent-toggle">
                <input type="checkbox" checked={draft.urgent} onChange={(event) => setDraft({ ...draft, urgent: event.target.checked })} />
                <span>Urgent only</span>
              </label>
            )}
            <span className="filter-updated small muted">
              {updatedAt ? `Updated ${formatDateTime(updatedAt)}` : "Loading cases…"}
            </span>
          </div>
        </div>
        <div className="desk-filter-row">
          <label className="desk-search" style={{ minWidth: "180px" }}>
            <Icon name="building" size={16} />
            <input
              className="input mono"
              aria-label="Institute code"
              value={draft.institute_code}
              onChange={(event) => setDraft({ ...draft, institute_code: event.target.value.toUpperCase() })}
              placeholder={isOwner ? "Institute code (all)" : "Enter code (e.g. APT-101)"}
              maxLength={32}
            />
          </label>
          {isOwner && (
            <label className="desk-search">
              <Icon name="search" size={16} />
              <input
                className="input"
                aria-label="Search reference"
                value={draft.search}
                onChange={(event) => setDraft({ ...draft, search: event.target.value.toUpperCase() })}
                placeholder="Search reference…"
                maxLength={16}
              />
            </label>
          )}
          {isOwner && (
            <select className="select" aria-label="Category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              <option value="">All categories</option>
              {CATEGORY_META.map((category) => <option key={category.value} value={category.value}>{category.value}</option>)}
              <option value={URGENT_CATEGORY}>{URGENT_CATEGORY}</option>
            </select>
          )}
          {isOwner && (
            <select className="select" aria-label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              <option value="">All statuses</option>
              <option value="in_process">In process</option>
              <option value="completed">Completed</option>
            </select>
          )}
          {isOwner && (
            <select className="select" aria-label="Spam filter" value={draft.spam} onChange={(event) => setDraft({ ...draft, spam: event.target.value })}>
              <option value="false">Visible only</option>
              <option value="true">Spam only</option>
              <option value="all">Include spam</option>
            </select>
          )}
          <div className="desk-filter-buttons">
            <button type="button" className="btn btn-ghost" onClick={resetFilters}>Clear</button>
            <button type="submit" className="btn btn-primary">
              <Icon name="search" size={15} /> {isOwner ? "Apply" : "Open & View Count"}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}

      {!isOwner ? (
        /* Staff view: Counts and category distribution only — NO sensitive data */
        <div className="staff-metrics-container">
          <section className="card category-breakdown-card">
            <div className="card-heading between">
              <div>
                <h2>Category Distribution Counts</h2>
                <p>
                  Complaint counts by category for {filters.institute_code || staffInstituteCode || "this college"}.
                </p>
              </div>
              <span className="badge badge-neutral">{summary.total} total cases</span>
            </div>
            <div className="category-counts-grid">
              {CATEGORY_META.map((cat) => {
                const count = byCategory[cat.value] || 0;
                const percent = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <div key={cat.value} className="category-stat-tile">
                    <div className="category-stat-header">
                      <span className="category-stat-name">{cat.value}</span>
                      <span className="category-stat-count mono">{count}</span>
                    </div>
                    <div className="category-stat-bar-track">
                      <div className="category-stat-bar-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="category-stat-percent small muted">{percent}% of reports</span>
                  </div>
                );
              })}
              {byCategory[URGENT_CATEGORY] !== undefined && byCategory[URGENT_CATEGORY] > 0 && (
                <div className="category-stat-tile category-stat-urgent">
                  <div className="category-stat-header">
                    <span className="category-stat-name">{URGENT_CATEGORY}</span>
                    <span className="category-stat-count mono">{byCategory[URGENT_CATEGORY]}</span>
                  </div>
                  <div className="category-stat-bar-track">
                    <div className="category-stat-bar-fill" style={{ width: `${summary.total > 0 ? Math.round((byCategory[URGENT_CATEGORY] / summary.total) * 100) : 0}%` }} />
                  </div>
                  <span className="category-stat-percent small muted">Urgent intervention required</span>
                </div>
              )}
            </div>
          </section>

          <section className="card privacy-shield-card">
            <div className="privacy-shield-content">
              <span className="icon-tile icon-tile-gold"><Icon name="shield" size={24} /></span>
              <div className="privacy-shield-copy">
                <h3>Strict Student Privacy Protection Active</h3>
                <p>
                  To prevent bias, victimisation, or retaliation against reporting students, individual complaint text ("kyu kya") and reporter identities ("kisne ki") are strictly confidential. Staff accounts have access to complaint counts and volume statistics only.
                </p>
                <div className="privacy-shield-pills">
                  <span className="privacy-pill"><Icon name="check" size={13} /> Aggregate counts only</span>
                  <span className="privacy-pill"><Icon name="lock" size={13} /> Student identities hidden</span>
                  <span className="privacy-pill"><Icon name="lock" size={13} /> Complaint descriptions protected</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* Owner view: Full cases table with links to individual cases */
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
              <table className="data-table cases-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Received</th>
                    <th aria-label="Actions" />
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
                      <td data-label="Reference">
                        <div className="ref-stack">
                          <span className="ref-line">
                            <span className="ref-cell">{item.ref_id}</span>
                            {item.urgent && <span className="badge badge-urgent">Urgent</span>}
                          </span>
                          <span className="ref-inst">{item.institute_code}</span>
                        </div>
                      </td>
                      <td data-label="Category"><span className="cell-clamp">{item.category}</span></td>
                      <td data-label="Status"><StatusBadge status={item.status} spam={item.flagged_spam} /></td>
                      <td data-label="Assigned">{item.assigned_to?.name || <span className="muted">Unassigned</span>}</td>
                      <td data-label="Received" className="nowrap">{formatDateTime(item.created_at)}</td>
                      <td className="cell-more">
                        <button
                          type="button"
                          className="row-more"
                          aria-label={`Open case ${item.ref_id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/desk/complaint/${item.ref_id}`);
                          }}
                        >
                          <Icon name="more" size={16} />
                        </button>
                      </td>
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
      )}
    </DeskShell>
  );
}

export default function DeskPage() {
  return <Protected><Dashboard /></Protected>;
}
