"use client";

import { useCallback, useEffect, useState } from "react";
import Protected, { useAuth } from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import Spinner from "../../../components/Spinner.jsx";
import { api } from "../../../lib/api.js";
import { formatDateTime } from "../../../lib/format.js";

const EMPTY_MEMBER = { name: "", email: "", password: "", role: "case_team" };

function passwordProblem(password) {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return "";
}

function StaffView() {
  const { member } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(EMPTY_MEMBER);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/api/staff/members");
      setMembers(result.members);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (member.role === "owner") load();
  }, [load, member.role]);

  if (member.role !== "owner") {
    return (
      <DeskShell title="Staff management">
        <div className="card empty-state">
          <span className="icon-tile icon-tile-amber"><Icon name="lock" size={24} /></span>
          <h2>Owner access required</h2>
          <p>Only an active owner can manage staff accounts.</p>
        </div>
      </DeskShell>
    );
  }

  async function createMember(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const problem = draft.password ? passwordProblem(draft.password) : "";
    if (problem) {
      setError(problem);
      return;
    }
    setCreating(true);
    try {
      await api("/api/staff/members", { method: "POST", json: draft });
      setDraft(EMPTY_MEMBER);
      setNotice("Staff member created. They will enrol 2FA on their first sign-in.");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  async function updateMember(target, patch, message) {
    setBusyId(target.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/staff/members/${target.id}`, { method: "PATCH", json: patch });
      setNotice(message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  async function resetMemberPassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const problem = passwordProblem(resetPassword);
    if (problem) {
      setError(problem);
      return;
    }
    setBusyId(resetFor);
    try {
      await api(`/api/staff/members/${resetFor}/reset-password`, { method: "POST", json: { password: resetPassword } });
      setNotice("Password reset. All sessions were revoked and 2FA enrolment is required again.");
      setResetFor("");
      setResetPassword("");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  async function revokeSessions(target) {
    if (!window.confirm(`Revoke all active sessions for ${target.name}?`)) return;
    setBusyId(target.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/staff/members/${target.id}/revoke-sessions`, { method: "POST" });
      setNotice(`All sessions for ${target.name} were revoked.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <DeskShell
      title="Staff management"
      subtitle="Owner-only control of Case Desk accounts, roles and sessions."
    >
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}
      {notice && <div className="alert alert-success" role="status"><Icon name="check" size={18} /> {notice}</div>}

      <div className="staff-layout">
        <section className="card table-card">
          <div className="card-heading between">
            <div>
              <h2>Case Desk accounts</h2>
              <p>Deactivating a member revokes their sessions immediately.</p>
            </div>
            <span className="badge badge-neutral">{members.length} member(s)</span>
          </div>

          {loading ? (
            <Spinner label="Loading staff accounts…" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Status</th><th>2FA</th><th>Last sign-in</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {members.map((row) => {
                    const isSelf = row.id === member.id;
                    const busy = busyId === row.id;
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.name}</strong>
                          <div className="small muted">{row.email}{isSelf ? " · You" : ""}</div>
                        </td>
                        <td>
                          <select
                            className="select select-small"
                            value={row.role}
                            disabled={busy}
                            onChange={(event) => updateMember(
                              row,
                              { role: event.target.value },
                              `${row.name} is now ${event.target.value === "owner" ? "an owner" : "case team"}.`
                            )}
                          >
                            <option value="owner">Owner</option>
                            <option value="case_team">Case team</option>
                          </select>
                        </td>
                        <td>
                          <span className={`badge ${row.status === "active" ? "status-completed" : "badge-spam"}`}>{row.status}</span>
                        </td>
                        <td>
                          <span className={`badge ${row.totp_enabled ? "status-completed" : "badge-urgent"}`}>
                            {row.totp_enabled ? "Enrolled" : "Pending"}
                          </span>
                        </td>
                        <td className="nowrap">{formatDateTime(row.last_login_at)}</td>
                        <td>
                          <div className="row row-wrap">
                            <button
                              type="button"
                              className="btn btn-ghost btn-small"
                              disabled={busy || isSelf}
                              onClick={() => updateMember(
                                row,
                                { status: row.status === "active" ? "inactive" : "active" },
                                `${row.name} is now ${row.status === "active" ? "inactive" : "active"}.`
                              )}
                            >
                              {row.status === "active" ? "Deactivate" : "Activate"}
                            </button>
                            <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => setResetFor(row.id)}>
                              Reset password
                            </button>
                            <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => revokeSessions(row)}>
                              Revoke sessions
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="stack">
          <section className="card side-card">
            <h2>Add a staff member</h2>
            <p className="small muted">
              Teachers see only the college leaderboard. Leave the password blank and the standard teacher password
              <strong> Teacher8686@# </strong> is set automatically.
            </p>
            <form className="stack" onSubmit={createMember}>
              <label className="field">
                <span className="field-label">Full name</span>
                <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={100} required />
              </label>
              <label className="field">
                <span className="field-label">Work email</span>
                <input className="input" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} autoComplete="off" required />
              </label>
              <label className="field">
                <span className="field-label">Password (optional)</span>
                <input className="input" type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} autoComplete="new-password" placeholder="Leave blank for Teacher8686@#" />
              </label>
              <label className="field">
                <span className="field-label">Role</span>
                <select className="select" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                  <option value="case_team">Case team (teacher)</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <button type="submit" className="btn btn-primary btn-block" disabled={creating}>
                {creating ? "Creating…" : "Create staff member"}
              </button>
            </form>
          </section>

          {resetFor && (
            <section className="card side-card">
              <h2>Reset password</h2>
              <p className="small muted">This revokes all sessions for the selected member and clears their 2FA enrolment.</p>
              <form className="stack" onSubmit={resetMemberPassword}>
                <label className="field">
                  <span className="field-label">New password</span>
                  <input className="input" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
                </label>
                <div className="row">
                  <button type="submit" className="btn btn-primary" disabled={busyId === resetFor}>Reset password</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setResetFor(""); setResetPassword(""); }}>Cancel</button>
                </div>
              </form>
            </section>
          )}
        </aside>
      </div>
    </DeskShell>
  );
}

export default function StaffPage() {
  return <Protected><StaffView /></Protected>;
}
