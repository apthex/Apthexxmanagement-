"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "./Protected.jsx";
import Icon from "./Icon.jsx";

const links = [
  { href: "/desk", label: "Complaints", icon: "home" },
  { href: "/desk/leaderboard", label: "Leaderboard", icon: "chart" },
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
      <header className="desk-header">
        <div className="desk-header-top">
          <Link href="/desk" className="desk-brand">
            <span className="brand-mark">APTHEX</span>
            <span className="desk-brand-sub">{member.role === "owner" ? "Case Desk" : "Teacher Desk"}</span>
          </Link>
          <div className="desk-user">
            <span className="desk-user-name">{member.name}</span>
            <span className={`badge role-${member.role}`}>{member.role === "owner" ? "Owner" : "Case team"}</span>
            <Link href="/" className="desk-public-link">Public portal</Link>
            <button type="button" className="btn btn-ghost btn-small" onClick={logout} disabled={loggingOut}>
              <Icon name="logout" size={16} /> {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
        <nav className="desk-nav" aria-label="Case Desk navigation">
          {links
            .filter((link) => !link.owner || member.role === "owner")
            .map((link) => {
              const active = link.href === "/desk" ? pathname === "/desk" : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={active ? "desk-nav-link active" : "desk-nav-link"} aria-current={active ? "page" : undefined}>
                  <Icon name={link.icon} size={17} />
                  {link.label}
                </Link>
              );
            })}
        </nav>
      </header>

      <main className="desk-main">
        <div className="desk-title-row">
          <div>
            <p className="eyebrow">APTHEX admin &amp; teacher area</p>
            <h1>{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="desk-actions">{actions}</div>}
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {children}
      </main>
    </div>
  );
}
