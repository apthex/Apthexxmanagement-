"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Protected, { useAuth } from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import { api } from "../../../lib/api.js";
import { formatDateTime } from "../../../lib/format.js";

const EMPTY_DRAFT = { name: "" };

function Dashboard() {
  const { member } = useAuth();
  const router = useRouter();
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");
  const [busyCode, setBusyCode] = useState("");
  const [query, setQuery] = useState("");

  // Ref IDs are an owner tool — teacher accounts go to their complaints view.
  useEffect(() => {
    if (member && member.role !== "owner") router.replace("/desk");
  }, [member, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/api/institutes/all");
      setInstitutes(result.institutes || []);
    } catch (requestError) {
      if (requestError.status === 401) return;
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (member && member.role !== "owner") return;
    load();
  }, [load, member]);

  async function generate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/institutes", { method: "POST", json: { name: draft.name } });
      const row = result.institute;
      setNotice(`${row.code} issued for ${row.name}. Share this ref ID with the college — students can report against it right away.`);
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (requestError) {
      setError(
        requestError.fields
          ? Object.values(requestError.fields).join(" · ")
          : requestError.message
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function regenerate(row) {
    if (!window.confirm(`Issue a fresh ref ID for ${row.name || "this code"}?\n\nThe current code ${row.code} will stop working immediately. Share the new code with the college.`)) return;
    setBusyCode(row.code);
    setError("");
    setNotice("");
    try {
      const result = await api(`/api/institutes/${encodeURIComponent(row.code)}/regenerate`, { method: "POST" });
      setNotice(`${result.previous_code} retired → ${result.institute.code} is the new ref ID for ${result.institute.name || "this college"}.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyCode("");
    }
  }

  async function toggleStatus(row) {
    const next = row.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !window.confirm(`Deactivate ${row.code}?\n\nStudents at ${row.name || "this college"} will not be able to submit complaints against it.`)) return;
    setBusyCode(row.code);
    setError("");
    setNotice("");
    try {
      await api(`/api/institutes/${encodeURIComponent(row.code)}`, {
        method: "PATCH",
        json: { status: next },
      });
      setNotice(`${row.code} is now ${next === "active" ? "active" : "deactivated"}.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyCode("");
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(""), 1800);
    } catch {
      // Clipboard unavailable — the code stays visible for manual copying.
    }
  }

  // Search by ref ID or college name — sirf client-side filter.
  const needle = query.trim().toLowerCase();
  const visible = institutes.filter(
    (row) => !needle || row.code.toLowerCase().includes(needle) || (row.name || "").toLowerCase().includes(needle)
  );

  return (
    <DeskShell
      title="Institute ref IDs"
      subtitle="Type a college's name, get its unique APXJIT-### code — the full register stays right below."
      actions={
        <button type="button" className="btn btn-secondary btn-small" onClick={load} disabled={loading}>
          <Icon name="refresh" size={16} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}
      {notice && <div className="alert alert-success" role="status"><Icon name="check" size={18} /> {notice}</div>}

      <section className="card refid-panel">
        <div className="card-heading">
          <h2>Generate an institute ref ID</h2>
          <p>
            Every college gets its own unique reporting code. Fill the name below and the code is created for
            you — it can never be guessed or reused by another college.
          </p>
          <ul className="check-list compact refid-steps">
            <li><Icon name="check" size={15} /> Type the college's full name in the box below.</li>
            <li><Icon name="check" size={15} /> Click <strong>Generate ref ID</strong> — a unique <span className="mono">APXJIT-###</span> code (like <span className="mono">APXJIT-234</span>) is created instantly.</li>
            <li><Icon name="check" size={15} /> The new code appears at the top of the register below — copy it and share it with the college.</li>
          </ul>
        </div>

        <form className="refid-form" onSubmit={generate}>
          <label className="field">
            <span className="field-label">College / Institute name</span>
            <input
              className="input"
              value={draft.name}
              onChange={(event) => setDraft({ name: event.target.value })}
              placeholder="e.g. K.K. Wagh Institute"
              maxLength={120}
              required
            />
          </label>
          <div className="refid-form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Icon name="building" size={16} /> {submitting ? "Generating…" : "Generate ref ID"}
            </button>
          </div>
        </form>
      </section>

      <div className="card table-card">
        <div className="card-heading between">
          <div>
            <h2>All ref IDs</h2>
            <p>{institutes.length} generated so far{needle ? ` · ${visible.length} matching your search` : ""}.</p>
          </div>
        </div>

        {institutes.length > 0 && (
          <div className="lb-search">
            <span className="icon-tile icon-tile-small"><Icon name="search" size={16} /></span>
            <input
              className="input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by ref ID (APXJIT-234) or college name…"
              aria-label="Search the ref-ID register by code or college name"
            />
            {query && (
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setQuery("")}>
                Clear
              </button>
            )}
          </div>
        )}

        {loading && !institutes.length ? (
          <div className="center-state center-state-inline"><span className="spinner" /><p>Loading ref IDs…</p></div>
        ) : institutes.length === 0 ? (
          <div className="empty-state">
            <span className="icon-tile"><Icon name="building" size={24} /></span>
            <h2>No ref IDs yet</h2>
            <p>Generate the first APXJIT-### code and hand it to a college.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <span className="icon-tile"><Icon name="search" size={24} /></span>
            <h2>No matches</h2>
            <p>Nothing in the register matches "{query.trim()}".</p>
          </div>
        ) : (
          <div className="inst-rows">
            {visible.map((row) => (
              <div className={`inst-row${row.status === "active" ? "" : " inst-row-off"}`} key={row.code}>
                <span className={`inst-code mono${row.status === "active" ? " inst-code-live" : ""}`}>
                  {row.code}
                </span>
                <div className="inst-info">
                  <strong>{row.assigned ? row.name : "— not assigned —"}</strong>
                  <span className="inst-meta">
                    {row.status === "active" ? "Active" : "Deactivated"} · issued {formatDateTime(row.created_at)}
                  </span>
                </div>
                <div className="inst-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => copyCode(row.code)}
                    aria-label={`Copy ${row.code}`}
                  >
                    <Icon name={copiedCode === row.code ? "check" : "copy"} size={14} />
                    {copiedCode === row.code ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => regenerate(row)}
                    disabled={busyCode === row.code}
                  >
                    <Icon name="refresh" size={14} /> New code
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ghost btn-small${row.status === "active" ? " refid-danger" : ""}`}
                    onClick={() => toggleStatus(row)}
                    disabled={busyCode === row.code}
                  >
                    <Icon name={row.status === "active" ? "lock" : "check"} size={14} />
                    {row.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DeskShell>
  );
}

export default function InstitutesPage() {
  return (
    <Protected>
      <Dashboard />
    </Protected>
  );
}
