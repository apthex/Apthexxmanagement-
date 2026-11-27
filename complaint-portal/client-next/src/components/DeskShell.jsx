"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "./Protected.jsx";
import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";

const links = [
  { href: "/desk", label: "Complaints", icon: "home" },
  { href: "/desk/leaderboard", label: "Leaderboard", icon: "layers" },
  { href: "/desk/institutes", label: "Institute ref IDs", icon: "building", owner: true },
  { href: "/desk/stats", label: "Reporting", icon: "list", owner: true },
  { href: "/desk/staff", label: "Staff accounts", icon: "users", owner: true },
];

export default function DeskShell({ children, title, subtitle, actions = null }) {
  const { member } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileEmail, setProfileEmail] = useState(member?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const eyebrow = pathname === "/desk" ? "Case Desk" : "APTHEX admin & teacher area";

  async function handleProfileUpdate(e) {
    e.preventDefault();
    setSettingsMsg(null);
    setSettingsLoading(true);
    try {
      const payload = {};
      if (profileEmail && profileEmail.trim() !== member.email) {
        payload.email = profileEmail.trim();
      }
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      if (Object.keys(payload).length === 0) {
        setSettingsMsg({ type: "error", text: "No changes provided." });
        setSettingsLoading(false);
        return;
      }

      const res = await api("/api/auth/update-profile", {
        method: "POST",
        json: payload,
      });

      setSettingsMsg({ type: "success", text: res.message || "Profile updated successfully! Refreshing..." });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setSettingsMsg({ type: "error", text: err.message || "Failed to update profile." });
      setSettingsLoading(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/complaint-review-console");
    } catch (requestError) {
      if (requestError.status === 401) {
        router.replace("/complaint-review-console");
        return;
      }
      setError(requestError.message);
      setLoggingOut(false);
    }
  }

  return (
    <div className="desk-shell">
      <aside className="desk-sidebar">
        <Link href="/desk" className="desk-brand" aria-label="APTHEX Case Desk home">
          <span className="desk-brand-lockup">
            <BrandMark className="desk-brand-logo" size={40} />
            <span className="desk-brand-copy">
              <span className="brand-mark">APTHEX</span>
              <span className="desk-brand-sub">{member.role === "owner" ? "Case Desk" : "Teacher Desk"}</span>
            </span>
          </span>
        </Link>

        <nav className="desk-nav" aria-label="Case Desk navigation">
          {links
            .filter((link) => !link.owner || member.role === "owner")
            .map((link) => {
              const active = link.href === "/desk" ? pathname === "/desk" : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={active ? "desk-nav-link active" : "desk-nav-link"} aria-current={active ? "page" : undefined}>
                  <Icon name={link.icon} size={17} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="desk-sidebar-foot">
          <div className="desk-help-card">
            <span className="desk-help-icon"><Icon name="headset" size={18} /></span>
            <div className="desk-help-copy">
              <span className="desk-help-label">Need help?</span>
              <a href="tel:+919421161446">94211 61446</a>
              <a href="mailto:help@apthex.com">help@apthex.com</a>
            </div>
          </div>
        </div>
      </aside>

      <div className="desk-frame">
        <header className="desk-topbar">
          <div className="desk-user">
            <span className="desk-user-name">{member.name}</span>
            <span className={`badge role-${member.role}`}>{member.role === "owner" ? "Owner" : "Case team"}</span>
          </div>
          <div className="desk-user-actions">
            <Link href="/" className="desk-public-link">
              Public portal <Icon name="external" size={13} />
            </Link>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setSettingsOpen(true)}>
              <Icon name="user" size={14} /> Settings
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={logout} disabled={loggingOut}>
              <Icon name="logout" size={15} /> {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        {settingsOpen && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div className="card" style={{ maxWidth: 440, width: "100%", background: "#0c0e14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Account &amp; Security</h3>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setSettingsOpen(false)} style={{ minWidth: "auto", padding: "4px 8px" }}>✕</button>
              </div>

              {settingsMsg && (
                <div style={{ padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 14, background: settingsMsg.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${settingsMsg.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, color: settingsMsg.type === "success" ? "#34d399" : "#f87171" }}>
                  {settingsMsg.text}
                </div>
              )}

              <form onSubmit={handleProfileUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#a1a1aa" }}>Email Address</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 12px", background: "#141722", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13 }}
                  />
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: 8 }}>Change Password</span>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#a1a1aa" }}>Current Password</label>
                      <input
                        type="password"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", background: "#141722", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#a1a1aa" }}>New Password</label>
                      <input
                        type="password"
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", background: "#141722", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13 }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={settingsLoading}>
                    {settingsLoading ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <main className="desk-main">
          <div className="desk-title-row">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="desk-actions">{actions}</div>}
          </div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
