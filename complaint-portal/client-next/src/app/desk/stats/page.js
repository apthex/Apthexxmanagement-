"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Protected, { useAuth } from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import Spinner from "../../../components/Spinner.jsx";
import { api } from "../../../lib/api.js";
import { monthOptions } from "../../../lib/format.js";

function StatsView() {
  const { member } = useAuth();
  const [institutes, setInstitutes] = useState([]);
  const [code, setCode] = useState("");
  const [month, setMonth] = useState(monthOptions(1)[0]?.value || "");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function loadInstitutes() {
    return api("/api/stats/institutes")
      .then((result) => {
        setInstitutes(result.institutes || []);
        setCode((current) => current || result.institutes?.[0]?.code || "");
      })
      .catch((requestError) => setError(requestError.message));
  }

  useEffect(() => {
    loadInstitutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError("");
    setStats(null);
    api(`/api/stats/institute/${encodeURIComponent(code)}`)
      .then(setStats)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [code]);

  async function sendReport() {
    if (!code || !month) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      await api("/api/reports/send", {
        method: "POST",
        json: { institute_code: code, month, force: true },
      });
      setNotice(`Monthly report for ${month} queued for ${code}. Check the email log for delivery status.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  function previewReport() {
    if (!code || !month) return;
    window.open(
      `/api/reports/preview?institute_code=${encodeURIComponent(code)}&month=${encodeURIComponent(month)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const months = monthOptions(18);

  return (
    <DeskShell
      title="Institute reporting"
      subtitle="Aggregate monthly counts and privacy-preserving institute reports."
    >
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}
      {notice && <div className="alert alert-success" role="status"><Icon name="check" size={18} /> {notice}</div>}

      <div className="report-layout">
        <section className="card">
          <div className="card-heading">
            <h2>Select an institute</h2>
            <p>Statistics contain aggregate counters only. Small counts are protected in exported reports.</p>
          </div>
          <label className="field">
            <span className="field-label">Institute</span>
            <select className="select" value={code} onChange={(event) => setCode(event.target.value)}>
              {institutes.length === 0 && <option value="">No institutes available</option>}
              {institutes.map((institute) => (
                <option key={institute.code} value={institute.code}>{institute.name} ({institute.code})</option>
              ))}
            </select>
          </label>

          {loading && <Spinner label="Loading institute statistics…" />}

          {stats && (
            <>
              <div className="stat-grid stat-grid-small">
                <article className="stat-card"><div><span>Received</span><strong>{stats.received}</strong></div></article>
                <article className="stat-card stat-complete"><div><span>Completed</span><strong>{stats.completed}</strong></div></article>
                <article className="stat-card"><div><span>In process</span><strong>{stats.in_process}</strong></div></article>
                <article className="stat-card stat-urgent"><div><span>Escalated</span><strong>{stats.escalated}</strong></div></article>
              </div>

              <div className="table-wrap report-table">
                <table className="data-table">
                  <thead><tr><th>Month</th><th>Received</th><th>Completed</th><th>Escalated</th></tr></thead>
                  <tbody>
                    {stats.months.length ? stats.months.slice().reverse().map((row) => (
                      <tr key={row.month}>
                        <td className="mono">{row.month}</td>
                        <td>{row.received}</td>
                        <td>{row.completed}</td>
                        <td>{row.escalated}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="muted">No monthly statistics recorded for this institute yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <aside className="stack">
          <section className="card side-card">
            <h2>Institute ref IDs</h2>
            <p className="small muted">
              College codes are issued from <strong>Institute ref IDs</strong> in the side menu — type the
              college's name there and a unique <span className="mono">APT-###</span> code is generated
              instantly. New codes appear in the student form right away.
            </p>
            <Link href="/desk/institutes" className="btn btn-secondary btn-block">
              <Icon name="building" size={16} /> Open institute ref IDs
            </Link>
          </section>

          <section className="card side-card">
            <h2>Monthly report</h2>
            <p className="small muted">
              One-page PDF with aggregate counts. No names, reference IDs, descriptions, category breakdowns or evidence.
            </p>
            <label className="field">
              <span className="field-label">Reporting month</span>
              <select className="select" value={month} onChange={(event) => setMonth(event.target.value)}>
                {months.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-secondary btn-block" onClick={previewReport} disabled={!code}>
              <Icon name="file" size={16} /> Preview PDF
            </button>
            {member.role === "owner" ? (
              <button type="button" className="btn btn-primary btn-block" onClick={sendReport} disabled={!code || sending}>
                <Icon name="mail" size={16} /> {sending ? "Queueing…" : "Email to institute head"}
              </button>
            ) : (
              <p className="small muted">Only an owner can email reports to institute heads.</p>
            )}
            <p className="small muted">Reports are queued through the audited email outbox.</p>
          </section>

          <section className="card side-card">
            <h2>Privacy safeguards</h2>
            <ul className="check-list compact">
              <li><Icon name="check" size={15} /> Counts below the approved threshold are shown as a range.</li>
              <li><Icon name="check" size={15} /> No case-level data leaves the Case Desk.</li>
              <li><Icon name="check" size={15} /> Every preview and send is audit logged.</li>
            </ul>
          </section>
        </aside>
      </div>
    </DeskShell>
  );
}

export default function StatsPage() {
  return <Protected><StatsView /></Protected>;
}
