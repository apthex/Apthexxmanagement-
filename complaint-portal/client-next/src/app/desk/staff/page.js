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
  if (!password) return "";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(password)) return "Password must contain a letter.";
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
  // Active/recent generated password — shown with quick copy
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedId, setCopiedId] = useState("");
  const [resetFor, setResetFor] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [busyId, setBusyId] = useState("");
  const [menuFor, setMenuFor] = useState("");

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

  // Close the row action menu on an outside click or Escape.
  useEffect(() => {
    if (!menuFor) return undefined;
    function closeOnOutside(event) {
      if (!event.target.closest(".staff-actions")) setMenuFor("");
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setMenuFor("");
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuFor]);

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

  function toggleReveal(id) {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function copyStaffPassword(pwd, id) {
    if (!pwd) return;
    try {
      await navigator.clipboard.writeText(pwd);
      setCopiedId(id);
      setTimeout(() => setCopiedId(""), 1800);
    } catch {}
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
        setNotice(`Staff account created for ${result.member.name}. Password: ${result.password} (Email sent with login details to ${result.member.email}).`);
      } else {
        setNotice(`${result.member.name} created. Account details emailed to ${result.member.email}.`);
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
    if (resetPassword.trim()) {
      const problem = passwordProblem(resetPassword.trim());
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusyId(resetFor);
    try {
      const result = await api(`/api/staff/members/${resetFor}/reset-password`, {
        method: "POST",
        json: { password: resetPassword.trim() || undefined },
      });
      if (result.password) {
        setGeneratedPassword(result.password);
        setNotice(`Password reset successfully! Updated password: ${result.password}. Email notification sent with login details.`);
      } else {
        setNotice("Password reset successfully. All sessions revoked.");
      }
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
      title="Staff Accounts"
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
          <div className="row row-wrap">
            <code className="generated-password mono">{generatedPassword}</code>
            <button type="button" className="btn btn-secondary btn-small" onClick={copyGeneratedPassword}>
              <Icon name={passwordCopied ? "check" : "copy"} size={15} /> {passwordCopied ? "Copied" : "Copy password"}
            </button>
          </div>
        </div>
      )}

      <div className="staff-layout">
        <section className="card staff-table-card">
          <div className="staff-card-head">
            <div className="staff-card-heading">
              <span className="staff-card-icon"><Icon name="layers" size={18} /></span>
              <div>
                <h2>Case Desk Accounts</h2>
                <p>Accounts with access to the internal case desk.</p>
              </div>
            </div>
            <span className="staff-count">{members.length} {members.length === 1 ? "Member" : "Members"}</span>
          </div>

          {loading ? (
            <div className="staff-loading"><Spinner label="Loading staff accounts…" /></div>
          ) : members.length === 0 ? (
            <div className="empty-state staff-empty">
              <span className="icon-tile"><Icon name="users" size={24} /></span>
              <h2>No staff accounts yet</h2>
              <p>Create the first teacher login using the form on the right.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table staff-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Institute</th>
                    <th>Password</th>
                    <th>Status</th>
                    <th>2FA</th>
                    <th>Last sign-in</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((row) => {
                    const isSelf = row.id === member.id;
                    const busy = busyId === row.id;
                    const lastSignIn = formatDateTime(row.last_login_at);
                    const [lastDate, lastTime] = lastSignIn === "—" ? ["—", ""] : lastSignIn.split(", ");
                    return (
                      <tr key={row.id}>
                        <td data-label="Name">
                          <div className="staff-person">
                            <strong>
                              {row.name}
                              {isSelf && <span className="staff-you">You</span>}
                            </strong>
                            <span>{row.email}</span>
                          </div>
                        </td>
                        <td data-label="Position">
                          <select
                            className="select select-small staff-select"
                            value={row.role}
                            disabled={busy}
                            aria-label={`Position for ${row.name}`}
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
                        <td data-label="Institute">
                          {row.role === "case_team" ? (
                            <select
                              className="select select-small staff-select staff-select-wide"
                              value={row.institute_code || ""}
                              disabled={busy}
                              aria-label={`Institute for ${row.name}`}
                              onChange={(event) => updateMember(
                                row,
                                { institute_code: event.target.value },
                                `${row.name} is now scoped to ${event.target.value}. They will only see that college's complaints.`
                              )}
                            >
                              <option value="">—</option>
                              {institutes.map((institute) => (
                                <option key={institute.code} value={institute.code}>{institute.code} · {institute.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="staff-static">All access</span>
                          )}
                        </td>
                        <td data-label="Password">
                          {row.last_password_issued ? (
                            <div className="staff-pwd-cell">
                              <code className="mono staff-pwd-pill">
                                {revealedPasswords[row.id] ? row.last_password_issued : "••••••••••••"}
                              </code>
                              <button
                                type="button"
                                className="btn btn-ghost btn-small staff-pwd-btn"
                                onClick={() => toggleReveal(row.id)}
                                title={revealedPasswords[row.id] ? "Hide password" : "Show password"}
                                aria-label={revealedPasswords[row.id] ? "Hide password" : "Show password"}
                              >
                                <Icon name={revealedPasswords[row.id] ? "eyeOff" : "eye"} size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-small staff-pwd-btn"
                                onClick={() => copyStaffPassword(row.last_password_issued, row.id)}
                                title="Copy password"
                                aria-label="Copy password"
                              >
                                <Icon name={copiedId === row.id ? "check" : "copy"} size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost btn-small staff-pwd-set"
                              onClick={() => { setResetFor(row.id); setResetPassword(""); }}
                            >
                              <Icon name="lock" size={12} /> Set pass
                            </button>
                          )}
                        </td>
                        <td data-label="Status">
                          <span className={`staff-pill ${row.status === "active" ? "is-ok" : "is-off"}`}>
                            <span className="staff-pill-dot" />
                            {row.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td data-label="2FA">
                          <span className={`staff-pill ${row.totp_enabled ? "is-ok" : "is-warn"}`}>
                            <span className="staff-pill-dot" />
                            {row.totp_enabled ? "Enrolled" : "Pending"}
                          </span>
                        </td>
                        <td data-label="Last sign-in">
                          <span className="staff-last">
                            <span>{lastDate}{lastTime ? "," : ""}</span>
                            {lastTime && <span>{lastTime}</span>}
                          </span>
                        </td>
                        <td className="staff-actions-cell">
                          <div className="staff-actions">
                            <button
                              type="button"
                              className="staff-more"
                              aria-label={`Actions for ${row.name}`}
                              aria-haspopup="menu"
                              aria-expanded={menuFor === row.id}
                              onClick={() => setMenuFor(menuFor === row.id ? "" : row.id)}
                            >
                              <Icon name="more" size={16} />
                            </button>
                            {menuFor === row.id && (
                              <div className="staff-menu" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={busy || isSelf}
                                  onClick={() => {
                                    setMenuFor("");
                                    updateMember(
                                      row,
                                      { status: row.status === "active" ? "inactive" : "active" },
                                      `${row.name} is now ${row.status === "active" ? "inactive" : "active"}.`
                                    );
                                  }}
                                >
                                  {row.status === "active" ? "Deactivate account" : "Activate account"}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={busy}
                                  onClick={() => { setMenuFor(""); setResetFor(row.id); }}
                                >
                                  Reset password
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={busy}
                                  onClick={() => { setMenuFor(""); revokeSessions(row); }}
                                >
                                  Revoke sessions
                                </button>
                              </div>
                            )}
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

        <aside className="staff-side">
          <section className="card staff-create-card">
            <div className="staff-card-heading staff-create-head">
              <span className="staff-card-icon"><Icon name="userPlus" size={18} /></span>
              <h2>Create a Login Account</h2>
            </div>
            <form className="staff-create-form" onSubmit={createMember}>
              <label className="field">
                <span className="field-label">Position</span>
                <select className="select" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                  <option value="case_team">Teacher — own college only</option>
                  <option value="owner">Admin — full Case Desk</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Full Name</span>
                <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Enter full name" maxLength={100} required />
              </label>
              <label className="field">
                <span className="field-label">Work Email</span>
                <input className="input" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="Enter work email" autoComplete="off" required />
              </label>
              {isTeacher ? (
                <label className="field">
                  <span className="field-label">Institute (Their College)</span>
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
                  <span className="field-hint">Password is generated automatically — each teacher gets their own.</span>
                </label>
              ) : (
                <label className="field">
                  <span className="field-label">Password</span>
                  <input className="input" type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Minimum 12 characters" autoComplete="new-password" minLength={12} required />
                </label>
              )}
              <button type="submit" className="btn btn-primary btn-block staff-create-submit" disabled={creating}>
                <Icon name="plus" size={16} /> {creating ? "Creating…" : isTeacher ? "Create Teacher Account" : "Create Admin Account"}
              </button>
            </form>
          </section>

          {resetFor && (
            <section className="card staff-create-card">
              <div className="staff-card-heading staff-create-head">
                <span className="staff-card-icon"><Icon name="lock" size={18} /></span>
                <h2>Reset / Generate Password</h2>
              </div>
              <p className="small muted staff-reset-note">
                Type a custom password or leave blank to auto-generate a secure password. An email with the new password and login link to <span className="mono">/admin</span> will be sent automatically.
              </p>
              <form className="staff-create-form" onSubmit={resetMemberPassword}>
                <label className="field">
                  <span className="field-label">New password (optional)</span>
                  <input
                    className="input"
                    type="text"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    placeholder="Leave blank to auto-generate"
                    autoComplete="off"
                  />
                  <span className="field-hint">Leave blank or enter custom password (min 8 characters)</span>
                </label>
                <div className="row row-wrap">
                  <button type="submit" className="btn btn-primary" disabled={busyId === resetFor}>
                    <Icon name="check" size={15} /> {resetPassword.trim() ? "Update password" : "Auto-generate & send email"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setResetFor(""); setResetPassword(""); }}>
                    Cancel
                  </button>
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
