"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../../components/Icon.jsx";
import { api } from "../../lib/api.js";

const APTHEX_MARK = (
  <g transform="translate(500, 500) scale(0.859) translate(-626, -610)">
    <path
      fill="currentColor"
      d="M1030.9 1034.8C1015.3 1011.8 986.9 970.4 979.2 959.5C974.5 952.9 960.1 932.4 947.2 914.0C905.1 854.0 835.4 756.3 776.6 675.0C759.9 651.8 756.1 646.6 733.9 616.0C721.7 599.2 708.6 581.2 704.9 576.0C701.1 570.8 697.0 565.3 695.8 563.7L693.5 561.0L680.9 572.2C654.5 595.8 554.0 687.0 500.0 736.4C417.3 812.1 340.7 884.2 234.6 986.2C215.9 1004.2 200.4 1018.7 200.2 1018.6C199.6 1017.9 270.6 921.3 300.5 882.0C384.0 772.4 543.2 571.3 627.9 468.5C649.0 442.9 699.4 382.2 725.6 351.0C788.5 276.0 881.3 170.6 879.7 176.0C879.5 176.8 873.2 196.2 865.7 219.0C858.3 241.8 846.7 277.4 840.0 298.0C833.3 318.6 821.2 355.8 813.0 380.5C804.8 405.2 794.0 438.0 789.1 453.2L780.1 480.9L785.2 491.2C791.4 503.9 812.7 548.2 818.7 561.0C823.3 570.6 825.3 575.1 870.0 670.5C883.9 700.2 899.0 732.6 903.5 742.5C908.0 752.4 915.7 769.0 920.5 779.5C946.0 834.9 995.7 946.0 1018.5 998.5C1024.9 1013.4 1032.0 1029.5 1034.1 1034.4C1036.2 1039.3 1037.8 1043.5 1037.6 1043.7C1037.4 1043.9 1034.4 1039.9 1030.9 1034.8ZM850.0 913.4C804.4 892.3 764.7 875.8 703.6 852.4C691.4 847.7 679.5 843.1 677.0 842.0C674.5 841.0 664.1 837.0 653.8 833.1L635.2 826.1L610.3 834.1C531.9 859.4 416.1 899.1 381.8 912.5C377.1 914.3 381.6 909.7 399.2 894.2C441.1 857.7 515.8 793.9 557.2 759.4L589.9 732.1L638.2 732.7L686.6 733.3L692.2 719.9C695.3 712.5 699.3 702.8 701.1 698.2C702.9 693.7 704.6 690.0 704.9 690.0C705.2 690.0 708.3 694.0 711.7 698.8C715.1 703.6 723.0 714.5 729.2 723.1C742.6 741.6 771.1 781.2 786.5 802.5C792.5 811.0 807.0 831.0 818.6 847.2C854.5 896.9 872.0 921.5 872.0 922.2C872.0 923.5 871.2 923.2 850.0 913.4Z"
    />
  </g>
);

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
          <svg className="brand-mark-svg" viewBox="0 0 1000 1000" aria-hidden="true">
            <rect x="125" y="125" width="750" height="750" rx="150" fill="#0A0A0C" />
            {APTHEX_MARK}
          </svg>
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
