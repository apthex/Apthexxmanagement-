"use client";

import { useEffect, useState } from "react";
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
  const [collegeDraft, setCollegeDraft] = useState({ name: "", head_name: "", head_email: "", type: "college" });
  const [creatingCollege, setCreatingCollege] = useState(false);
  const [collegeNotice, setCollegeNotice] = useState(null);

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

  async function createCollege(event) {
    event.preventDefault();
    setCreatingCollege(true);
    setError("");
    setCollegeNotice(null);
    try {
      const result = await api("/api/institutes", { method: "POST", json: collegeDraft });
      setCollegeNotice(result.institute);
      setCollegeDraft({ name: "", head_name: "", head_email: "", type: "college" });
      await loadInstitutes();
    } catch (requestError) {
      setError(requestError.fields ? Object.values(requestError.fields).join(" · ") : requestError.message);
    } finally {
      setCreatingCollege(false);
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
            <h2>Add a college</h2>
            <p className="small muted">College ka naam, contact person aur email likho — ye turant student form ke dropdown me aa jayega. Code apne aap ban jata hai.</p>
            {collegeNotice && (
              <div className="alert alert-success" role="status">
                <Icon name="check" size={16} />
                <span>
                  Added! Institute code: <strong className="mono">{collegeNotice.code}</strong>
                </span>
              </div>
            )}
            <form className="stack" onSubmit={createCollege}>
              <label className="field">
                <span className="field-label">College / Institute name</span>
                <input
                  className="input"
                  value={collegeDraft.name}
                  onChange={(event) => setCollegeDraft({ ...collegeDraft, name: event.target.value })}
                  maxLength={120}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Contact person name</span>
                <input
                  className="input"
                  value={collegeDraft.head_name}
                  onChange={(event) => setCollegeDraft({ ...collegeDraft, head_name: event.target.value })}
                  maxLength={100}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Contact email</span>
                <input
                  className="input"
                  type="email"
                  value={collegeDraft.head_email}
                  onChange={(event) => setCollegeDraft({ ...collegeDraft, head_email: event.target.value })}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Type</span>
                <select
                  className="select"
                  value={collegeDraft.type}
                  onChange={(event) => setCollegeDraft({ ...collegeDraft, type: event.target.value })}
                >
                  <option value="college">College</option>
                  <option value="school">School</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <button type="submit" className="btn btn-primary btn-block" disabled={creatingCollege}>
                <Icon name="building" size={16} /> {creatingCollege ? "Adding…" : "Add college"}
              </button>
            </form>
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
