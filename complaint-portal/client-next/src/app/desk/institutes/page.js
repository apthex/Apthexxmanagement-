"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Protected, { useAuth } from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import { api } from "../../../lib/api.js";
import { formatDateTime } from "../../../lib/format.js";

const EMPTY_DRAFT = { name: "", codeSuffix: "" };

function Dashboard() {
  const { member } = useAuth();
  const router = useRouter();
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [codeStatus, setCodeStatus] = useState({ checking: false, exists: null, message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");
  const [busyCode, setBusyCode] = useState("");
  const [query, setQuery] = useState("");

  // Ref IDs are an owner tool — teacher accounts go to their complaints view.
  useEffect(() => {
    if (member && member.role !== "owner") router.replace("/desk");
  }, [member, router]);

  // Live code availability check for custom APT- code
  useEffect(() => {
    const raw = (draft.codeSuffix || "").trim();
    if (!raw) {
      setCodeStatus({ checking: false, exists: null, message: "" });
      return;
    }
    const timer = setTimeout(async () => {
      setCodeStatus((prev) => ({ ...prev, checking: true }));
      try {
        const fullCode = `APT-${raw.replace(/^APT-?/i, "").toUpperCase()}`;
        const result = await api(`/api/institutes/check-code?code=${encodeURIComponent(fullCode)}`);
        setCodeStatus({ checking: false, exists: result.exists, message: result.message });
      } catch {
        setCodeStatus({ checking: false, exists: null, message: "" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draft.codeSuffix]);

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
      const customCode = draft.codeSuffix.trim()
        ? `APT-${draft.codeSuffix.trim().replace(/^APT-?/i, "").toUpperCase()}`
        : undefined;
      const result = await api("/api/institutes", {
        method: "POST",
        json: {
          name: draft.name.trim(),
          code: customCode,
        },
      });
      const row = result.institute;
      setNotice(`${row.code} issued for ${row.name}. Share this ref ID with the college — students can report against it right away.`);
      setDraft(EMPTY_DRAFT);
      setCodeStatus({ checking: false, exists: null, message: "" });
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
    const input = window.prompt(
      `Issue a fresh ref ID for ${row.name || "this code"}?\n\nCurrent code: ${row.code}\n\nType a custom code suffix (e.g. 102 for APT-102), or leave blank to auto-allocate a random APT-### code:`,
      ""
    );
    if (input === null) return;
    const requestedCode = input.trim()
      ? `APT-${input.trim().replace(/^APT-?/i, "").toUpperCase()}`
      : undefined;
    setBusyCode(row.code);
    setError("");
    setNotice("");
    try {
      const result = await api(`/api/institutes/${encodeURIComponent(row.code)}/regenerate`, {
        method: "POST",
        json: { new_code: requestedCode },
      });
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
      subtitle="Issue a unique APT-### or custom institute code for colleges — students report against it directly."
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
          <h2>Generate or Customize an Institute Ref ID</h2>
          <p>
            Every college gets its own unique reporting code starting with <strong>APT-</strong>. Type a custom
            code suffix (like 101, DYP, etc.) or leave it blank to auto-allocate a unique random APT-### code.
          </p>
          <ul className="check-list compact refid-steps">
            <li><Icon name="check" size={15} /> Type the college's full name.</li>
            <li><Icon name="check" size={15} /> Enter a custom suffix after <span className="mono">APT-</span> or leave blank for a random <span className="mono">APT-###</span> code.</li>
            <li><Icon name="check" size={15} /> The code appears in the register below — copy and share it with the college.</li>
          </ul>
        </div>

        <form className="refid-form" onSubmit={generate}>
          <label className="field">
            <span className="field-label">College / Institute name</span>
            <input
              className="input"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. K.K. Wagh Institute"
              maxLength={120}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Custom Code (Optional)</span>
            <div className="code-input-wrap">
              <span className="code-input-prefix">APT-</span>
              <input
                className="input code-input-field"
                value={draft.codeSuffix}
                onChange={(event) => {
                  const cleaned = event.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase();
                  setDraft({ ...draft, codeSuffix: cleaned });
                }}
                placeholder="101, DYP, etc."
                maxLength={25}
              />
            </div>
            {codeStatus.message ? (
              <span className={`code-status-pill ${codeStatus.exists ? "code-status-taken" : "code-status-avail"}`}>
                <Icon name={codeStatus.exists ? "alert" : "check"} size={13} />
                {codeStatus.message}
              </span>
            ) : (
              <span className="field-hint">Leave blank to auto-generate random APT-###</span>
            )}
          </label>

          <div className="refid-form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting || codeStatus.exists === true}>
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
              placeholder="Search by ref ID (APT-101) or college name…"
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
            <p>Generate the first APT-### code and hand it to a college.</p>
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
