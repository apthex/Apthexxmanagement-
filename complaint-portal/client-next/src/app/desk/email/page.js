"use client";

import { useCallback, useEffect, useState } from "react";
import Protected, { useAuth } from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import Spinner from "../../../components/Spinner.jsx";
import { api } from "../../../lib/api.js";
import { formatDateTime } from "../../../lib/format.js";

const KINDS = ["new_complaint", "urgent", "reporter_confirmation", "monthly_report", "escalation", "system", "test"];
const STATUSES = ["pending", "sending", "sent", "dev_logged", "failed", "dead"];

function EmailView() {
  const { member } = useAuth();
  const [draft, setDraft] = useState({ status: "", kind: "" });
  const [filters, setFilters] = useState({ status: "", kind: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filters.status) params.set("status", filters.status);
    if (filters.kind) params.set("kind", filters.kind);
    try {
      setData(await api(`/api/staff/outbox?${params.toString()}`));
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
      <DeskShell title="Email log">
        <div className="card empty-state">
          <span className="icon-tile icon-tile-amber"><Icon name="lock" size={24} /></span>
          <h2>Owner access required</h2>
          <p>The outbox log is restricted to active owners.</p>
        </div>
      </DeskShell>
    );
  }

  async function processOutbox() {
    setProcessing(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/staff/outbox/process", { method: "POST" });
      setNotice(`Processed ${result.summary.processed} message(s): ${result.summary.sent} sent, ${result.summary.devLogged} development-logged, ${result.summary.failed} failed.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessing(false);
    }
  }

  async function sendTestEmail(event) {
    event.preventDefault();
    setSendingTest(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/staff/outbox/test", { method: "POST", json: { email: testEmail } });
      setNotice(result.note || `Test email queued for ${result.to}.`);
      await load();
    } catch (requestError) {
      setError(requestError.fields ? Object.values(requestError.fields).join(" · ") : requestError.message);
    } finally {
      setSendingTest(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <DeskShell
      title="Email outbox"
      subtitle="Audited delivery log for complaint alerts, confirmations and institute reports."
      actions={
        <button type="button" className="btn btn-secondary btn-small" onClick={processOutbox} disabled={processing}>
          <Icon name="refresh" size={16} /> {processing ? "Processing…" : "Process queue"}
        </button>
      }
    >
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}
      {notice && <div className="alert alert-success" role="status"><Icon name="check" size={18} /> {notice}</div>}

      <form className="card filter-card" onSubmit={sendTestEmail}>
        <span className="mini-label">Email self-test</span>
        <div className="row-wrap between filter-actions" style={{ marginTop: 8 }}>
          <label className="field" style={{ flex: "1 1 260px", marginBottom: 0 }}>
            <span className="field-label">Send a test email to</span>
            <input
              className="input"
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="off"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={sendingTest}>
            <Icon name="mail" size={16} /> {sendingTest ? "Queueing…" : "Send test email"}
          </button>
        </div>
        <p className="field-hint" style={{ marginTop: 8 }}>
          Verify your email setup: a test message is queued and its delivery status appears below within seconds
          (sent = real delivery working, dev_logged = emails are only being logged).
        </p>
      </form>

      <form
        className="card filter-card"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setFilters({ ...draft });
        }}
      >
        <div className="filter-grid filter-grid-two">
          <label className="field">
            <span className="field-label">Delivery status</span>
            <select className="select" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              <option value="">All statuses</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Message kind</span>
            <select className="select" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}>
              <option value="">All kinds</option>
              {KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </label>
        </div>
        <div className="between filter-actions">
          <span className="small muted">Recipient email addresses are masked in this view.</span>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => { setDraft({ status: "", kind: "" }); setFilters({ status: "", kind: "" }); setPage(1); }}>Clear</button>
            <button type="submit" className="btn btn-secondary btn-small"><Icon name="search" size={15} /> Apply</button>
          </div>
        </div>
      </form>

      <div className="card table-card">
        {loading && !data ? (
          <Spinner label="Loading email log…" />
        ) : !data?.items?.length ? (
          <div className="empty-state"><h2>No messages in the outbox</h2><p>New complaint alerts will appear here when queued.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table audit-table">
              <thead>
                <tr><th>Created</th><th>Kind</th><th>Recipient</th><th>Subject</th><th>Status</th><th>Attempts</th><th>Last error</th></tr>
              </thead>
              <tbody>
                {data.items.map((message) => (
                  <tr key={message._id}>
                    <td className="nowrap">{formatDateTime(message.created_at)}</td>
                    <td><code className="inline-code">{message.kind}</code></td>
                    <td className="mono small">{message.to}</td>
                    <td><span className="cell-clamp" title={message.subject}>{message.subject}</span></td>
                    <td><span className={`badge email-${message.status}`}>{message.status}</span></td>
                    <td>{message.attempts}</td>
                    <td><span className="cell-clamp detail-cell" title={message.last_error || ""}>{message.last_error || "—"}</span></td>
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

export default function EmailPage() {
  return <Protected><EmailView /></Protected>;
}
