"use client";

import { useCallback, useEffect, useState } from "react";
import Protected, { useAuth } from "../../../components/Protected.jsx";
import DeskShell from "../../../components/DeskShell.jsx";
import Icon from "../../../components/Icon.jsx";
import Spinner from "../../../components/Spinner.jsx";
import { api } from "../../../lib/api.js";
import { formatDateTime } from "../../../lib/format.js";

const EMPTY_MEMBER = { name: "", email: "", password: "", role: "case_team", institute_code: "" };

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
  const [institutes, setInstitutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(EMPTY_MEMBER);
  const [creating, setCreating] = useState(false);
  // Unique generated password — shown exactly once so the owner can hand it
  // to the teacher. Never stored in plain text server-side.
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [resetFor, setResetFor] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [busyId, setBusyId] = useState("");

  const isTeacher = draft.role === "case_team";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [staffResult, instituteResult] = await Promise.all([
        api("/api/staff/members"),
        api("/api/institutes/all"),
      ]);
      setMembers(staffResult.members);
      setInstitutes((instituteResult.institutes || []).filter((row) => row.assigned && row.status === "active"));
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
      <DeskShell title="Staff accounts">
        <div className="card empty-state">
          <span className="icon-tile icon-tile-amber"><Icon name="lock" size={24} /></span>
          <h2>Admin access required</h2>
          <p>Only an active admin can manage staff accounts.</p>
        </div>
      </DeskShell>
    );
  }

  async function copyGeneratedPassword() {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the password stays visible for manual copying.
    }
  }

  async function createMember(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setGeneratedPassword("");
    const payload = { name: draft.name, email: draft.email, role: draft.role };
    if (isTeacher) {
      if (!draft.institute_code) {
        setError("Select the teacher's institute — they can only see complaints from that college.");
        return;
      }
      payload.institute_code = draft.institute_code;
    } else {
      const problem = draft.password ? passwordProblem(draft.password) : "";
      if (problem) {
        setError(problem);
        return;
      }
      if (!draft.password) {
        setError("Admin accounts need a password.");
        return;
      }
      payload.password = draft.password;
    }
    setCreating(true);
    try {
      const result = await api("/api/staff/members", { method: "POST", json: payload });
      setDraft(EMPTY_MEMBER);
      if (result.password) {
        setGeneratedPassword(result.password);
        setNotice(`${result.member.name} created with their own separate password. Share it with them — it is shown only this once.`);
      } else {
        setNotice(`${result.member.name} created. They will enrol 2FA on their first sign-in.`);
      }
      await load();
    } catch (requestError) {
      setError(requestError.fields ? Object.values(requestError.fields).join(" · ") : requestError.message);
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
      setError(requestError.fields ? Object.values(requestError.fields).join(" · ") : requestError.message);
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
      title="Staff accounts"
      subtitle="Create admin and teacher logins. Every teacher gets their own password and sees only their college."
    >
      {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={18} /> {error}</div>}
      {notice && <div className="alert alert-success" role="status"><Icon name="check" size={18} /> {notice}</div>}

      {generatedPassword && (
        <div className="card generated-password-card" role="status">
          <div className="card-heading">
            <h2>Teacher password — copy it now</h2>
            <p>This is the only time the password is shown. Hand it to the teacher privately.</p>
          </div>
          <div className="row">
            <code className="generated-password mono">{generatedPassword}</code>
            <button type="button" className="btn btn-secondary btn-small" onClick={copyGeneratedPassword}>
              <Icon name={passwordCopied ? "check" : "copy"} size={15} /> {passwordCopied ? "Copied" : "Copy password"}
            </button>
          </div>
        </div>
      )}

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
                  <tr><th>Name</th><th>Position</th><th>Institute</th><th>Status</th><th>2FA</th><th>Last sign-in</th><th>Actions</th></tr>
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
                              `${row.name} is now ${event.target.value === "owner" ? "an admin" : "a teacher"}.`
                            )}
                          >
                            <option value="owner">Admin</option>
                            <option value="case_team">Teacher</option>
                          </select>
                        </td>
                        <td>
                          {row.role === "case_team" ? (
                            <select
                              className="select select-small"
                              value={row.institute_code || ""}
                              disabled={busy}
                              onChange={(event) => updateMember(
                                row,
                                { institute_code: event.target.value },
                                `${row.name} is now scoped to ${event.target.value}. They will only see that college's complaints.`
                              )}
                            >
                              <option value="">— not set —</option>
                              {institutes.map((institute) => (
                                <option key={institute.code} value={institute.code}>{institute.code} · {institute.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="muted">All access</span>
                          )}
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
            <h2>Create a login account</h2>
            <p className="small muted">
              Pick the position first. Teachers get a unique password generated here — share it with them — and they only
              ever see complaints from the college you attach to their account.
            </p>
            <form className="stack" onSubmit={createMember}>
              <label className="field">
                <span className="field-label">Position</span>
                <select className="select" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                  <option value="case_team">Teacher — own college only</option>
                  <option value="owner">Admin — full Case Desk</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Full name</span>
                <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={100} required />
              </label>
              <label className="field">
                <span className="field-label">Work email</span>
                <input className="input" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} autoComplete="off" required />
              </label>
              {isTeacher ? (
                <label className="field">
                  <span className="field-label">Institute (their college)</span>
                  <select
                    className="select"
                    value={draft.institute_code}
                    onChange={(event) => setDraft({ ...draft, institute_code: event.target.value })}
                    required
                  >
                    <option value="">Select a college…</option>
                    {institutes.map((institute) => (
                      <option key={institute.code} value={institute.code}>{institute.code} · {institute.name}</option>
                    ))}
                  </select>
                  <span className="small muted">Password is generated automatically — each teacher gets their own.</span>
                </label>
              ) : (
                <label className="field">
                  <span className="field-label">Password</span>
                  <input className="input" type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} autoComplete="new-password" minLength={12} required />
                </label>
              )}
              <button type="submit" className="btn btn-primary btn-block" disabled={creating}>
                {creating ? "Creating…" : isTeacher ? "Create teacher account" : "Create admin account"}
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
