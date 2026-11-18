"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../components/Icon.jsx";
import { api } from "../../lib/api.js";

const FEATURES = [
  { icon: "shield", title: "Secure Access", text: "Private passwords, revocable sessions" },
  { icon: "layers", title: "Case Management", text: "Review, route and resolve cases" },
  { icon: "users", title: "Role-Based Access", text: "Admins see all, teachers their college" },
  { icon: "clock", title: "Audit & History", text: "Timestamped trail of every action" },
];

// Pointer-driven interactions (tilt, cursor light) run only for fine
// pointers and are skipped entirely when reduced motion is requested.
function motionAllowed() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function trackBeam(event) {
  if (!motionAllowed()) return;
  const panel = event.currentTarget;
  const rect = panel.getBoundingClientRect();
  panel.style.setProperty("--beam-x", `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
  panel.style.setProperty("--beam-y", `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
}

function tiltCard(event) {
  if (!motionAllowed()) return;
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;
  card.style.setProperty("--rx", `${((0.5 - py) * 9).toFixed(2)}deg`);
  card.style.setProperty("--ry", `${((px - 0.5) * 9).toFixed(2)}deg`);
  card.style.setProperty("--glow-x", `${(px * 100).toFixed(1)}%`);
  card.style.setProperty("--glow-y", `${(py * 100).toFixed(1)}%`);
}

function resetTilt(event) {
  const card = event.currentTarget;
  card.style.setProperty("--rx", "0deg");
  card.style.setProperty("--ry", "0deg");
}

export default function StaffLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    if (!password.trim()) {
      setError("Enter your password to continue.");
      return;
    }
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
      {/* Ambient architectural scene — decorative only */}
      <div className="auth-scene" aria-hidden="true">
        <span className="scene-glow" />
        <span className="scene-bars" />
        <span className="scene-eclipse" />
        <span className="scene-arc scene-arc-a" />
        <span className="scene-arc scene-arc-b" />
        <span className="scene-podium" />
        <span className="scene-floor" />
        <i className="scene-mote mote-1" />
        <i className="scene-mote mote-2" />
        <i className="scene-mote mote-3" />
        <i className="scene-mote mote-4" />
        <i className="scene-mote mote-5" />
      </div>

      <header className="auth-top">
        <Link href="/" className="brand" aria-label="APTHEX Complaint Portal home">
          <span className="brand-mark">APTHEX</span>
          <span className="brand-sep" aria-hidden="true" />
          <span className="brand-sub">Complaint Portal</span>
        </Link>
        <div className="auth-top-side">
          <span className="auth-access-chip">
            <i className="chip-dot" aria-hidden="true" /> Admin &amp; teacher access
          </span>
          <Link href="/" className="btn btn-ghost btn-small auth-portal-link">
            <Icon name="external" size={15} /> Public portal
          </Link>
        </div>
      </header>

      <main className="auth-stage">
        <section className="auth-intro" aria-labelledby="auth-heading">
          <p className="eyebrow auth-eyebrow rise">
            <span className="eyebrow-dash" aria-hidden="true" />Institute case management
          </p>
          <h1 id="auth-heading" className="auth-heading rise" style={{ animationDelay: "0.08s" }}>
            <span className="auth-heading-brand">APTHEX</span>
            <em>Case Desk</em>
          </h1>
          <p className="auth-lede rise" style={{ animationDelay: "0.16s" }}>
            A secure, confidential and role-based platform to review, manage and resolve student
            complaints efficiently.
          </p>
          <ul className="auth-features">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.title}
                className="auth-feature"
                style={{ animationDelay: `${(0.26 + index * 0.07).toFixed(2)}s` }}
                onPointerMove={tiltCard}
                onPointerLeave={resetTilt}
              >
                <span className="auth-feature-icon"><Icon name={feature.icon} size={21} /></span>
                <strong>{feature.title}</strong>
                <span className="auth-feature-text">{feature.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="auth-panel" onPointerMove={trackBeam} aria-labelledby="auth-panel-heading">
          {!setup ? (
            <>
              <span className="auth-panel-icon"><Icon name="lock" size={22} /></span>
              <h2 id="auth-panel-heading">Sign in to Case Desk</h2>
              <p className="auth-panel-sub">Enter your staff password to access the complaint management system.</p>
              <form className="auth-form" onSubmit={login}>
                <label className="auth-field">
                  <span className="auth-label">Password</span>
                  <span className="auth-input-wrap">
                    <Icon name="lock" size={16} className="auth-input-icon" />
                    <input
                      className="auth-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                    />
                    <input
                      className="auth-input auth-input-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").toUpperCase().slice(0, 8))}
                      inputMode="text"
                      placeholder="Institute code (e.g. APS001)"
                      maxLength={8}
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                    </button>
                  </span>
                </label>
                {(needsCode || code) && (
                  <label className="auth-field">
                    <span className="auth-label">Authenticator code</span>
                    <input
                      className="auth-input auth-input-code"
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
                <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
                  {loading ? (
                    <><span className="spinner spinner-small" /> Verifying…</>
                  ) : (
                    <>Sign In Securely <Icon name="arrowRight" size={18} className="auth-submit-arrow" /></>
                  )}
                </button>
              </form>
              <div className="auth-panel-foot">
                <span className="auth-foot-item"><Icon name="shield" size={15} /> Internal access only</span>
                <span className="auth-foot-sep" aria-hidden="true" />
                <span className="auth-foot-item">One password per staff member</span>
              </div>
            </>
          ) : (
            <>
              <span className="auth-panel-icon"><Icon name="lock" size={22} /></span>
              <h2 id="auth-panel-heading">Set up two-factor authentication</h2>
              <p className="auth-panel-sub">Add this account to an authenticator app, then enter the 6-digit code it shows.</p>
              <div className="setup-secret">
                <span className="mini-label">Manual setup key</span>
                <code>{setup.secret}</code>
                {setup.email && <span className="small muted">Account: {setup.email}</span>}
              </div>
              <details className="setup-details">
                <summary>Having trouble? Show the otpauth link</summary>
                <code className="break-all">{setup.otpauthUrl}</code>
              </details>
              <form className="auth-form" onSubmit={finishSetup}>
                <label className="auth-field">
                  <span className="auth-label">6-digit authenticator code</span>
                  <input
                    className="auth-input auth-input-code"
                    value={setupCode}
                    onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </label>
                {error && <p className="alert alert-error" role="alert"><Icon name="alert" size={17} /> {error}</p>}
                <button
                  type="submit"
                  className="btn btn-primary btn-block auth-submit"
                  disabled={setupLoading || setupCode.length < 6}
                >
                  {setupLoading ? (
                    <><span className="spinner spinner-small" /> Verifying…</>
                  ) : (
                    <>Verify and open Case Desk <Icon name="arrowRight" size={18} className="auth-submit-arrow" /></>
                  )}
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
