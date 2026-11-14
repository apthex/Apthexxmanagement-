"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../../components/Icon.jsx";
import { api } from "../../../lib/api.js";

export default function StaffLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [setup, setSetup] = useState(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  async function login(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        json: { password, code: code.trim() || undefined },
      });
      if (data.setupRequired) {
        setSetup({
          setupToken: data.setupToken,
          secret: data.secret,
          otpauthUrl: data.otpauthUrl,
        });
        return;
      }
      router.replace("/desk");
    } catch (requestError) {
      if (requestError.data?.twoFactorRequired) setNeedsCode(true);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function finishSetup(event) {
    event.preventDefault();
    setError("");
    setSetupLoading(true);
    try {
      await api("/api/auth/setup-2fa", {
        method: "POST",
        json: {
          email: setup.email,
          setupToken: setup.setupToken,
          code: setupCode.trim(),
        },
      });
      router.replace("/desk");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSetupLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <header className="auth-top">
        <Link href="/" className="brand" aria-label="APTHEX Complaint Portal home">
          <span className="brand-mark">APTHEX</span>
          <span className="brand-sub">Complaint Portal</span>
        </Link>
        <Link href="/" className="btn btn-ghost btn-small">
          <Icon name="arrowLeft" size={16} /> Public portal
        </Link>
      </header>

      <main className="auth-grid">
        <aside className="auth-aside">
          <p className="eyebrow"><Icon name="lock" size={15} /> Admin &amp; teacher sign in</p>
          <h1>APTHEX Case Desk</h1>
          <p>
            Students never need an account — complaints go through the public form. Staff sign in
            here with a password only: the admin password opens the Admin Desk, the teacher
            password opens the teacher desk.
          </p>
          <ul className="check-list">
            <li><Icon name="check" size={16} /> Password-only sign in — no email needed</li>
            <li><Icon name="check" size={16} /> Short-lived, revocable sessions</li>
            <li><Icon name="check" size={16} /> Private evidence accessed through signed links</li>
            <li><Icon name="check" size={16} /> No access for institute staff</li>
          </ul>
        </aside>

        <section className="card auth-card">
          {!setup ? (
            <>
              <div className="card-heading">
                <h2>Admin / Teacher sign in</h2>
                <p>Type your password — the admin password opens the Admin Desk, the teacher password opens the teacher desk.</p>
              </div>
              <form className="stack" onSubmit={login}>
                <label className="field">
                  <span className="field-label">Password</span>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                {(needsCode || code) && (
                  <label className="field">
                    <span className="field-label">Authenticator code</span>
                    <input
                      className="input input-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      maxLength={6}
                    />
                  </label>
                )}
                {error && <p className="alert alert-error" role="alert"><Icon name="alert" size={17} /> {error}</p>}
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                  {loading ? <><span className="spinner spinner-small" /> Signing in…</> : "Sign in securely"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="card-heading">
                <span className="icon-tile icon-tile-red"><Icon name="lock" size={24} /></span>
                <h2>Set up two-factor authentication</h2>
                <p>Add this account to an authenticator app, then enter the 6-digit code it shows.</p>
              </div>
              <div className="setup-secret">
                <span className="mini-label">Manual setup key</span>
                <code>{setup.secret}</code>
                {setup.email && <span className="small muted">Account: {setup.email}</span>}
              </div>
              <details className="setup-details">
                <summary>Having trouble? Show the otpauth link</summary>
                <code className="break-all">{setup.otpauthUrl}</code>
              </details>
              <form className="stack" onSubmit={finishSetup}>
                <label className="field">
                  <span className="field-label">6-digit authenticator code</span>
                  <input
                    className="input input-code"
                    value={setupCode}
                    onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </label>
                {error && <p className="alert alert-error" role="alert"><Icon name="alert" size={17} /> {error}</p>}
                <button type="submit" className="btn btn-primary btn-block" disabled={setupLoading || setupCode.length < 6}>
                  {setupLoading ? "Verifying…" : "Verify and open Case Desk"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => {
                    setSetup(null);
                    setPassword("");
                    setCode("");
                    setError("");
                  }}
                >
                  Start over
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
