"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  KeyRound,
  ListChecks,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  Moon,
  NotebookPen,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/role-access";
import type { SessionUser } from "@/lib/portal-types";
import { PortalProvider, usePortal } from "@/components/portal/context";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  pulse?: boolean;
};

const WORKSPACE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Live Analytics", icon: Activity, exact: true, pulse: true },
];

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="group flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red/40"
      aria-label="Apthex Ops Workspace"
    >
      <span className="relative flex size-7 items-center justify-center rounded-lg bg-black text-white shadow-sm transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-4 fill-current text-red-500" aria-hidden>
          <path d="M12 3L2 21h20L12 3zm0 5.5l5.5 10h-11L12 8.5z" />
        </svg>
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-bold tracking-tight text-white">
          APTHEX
        </span>
        <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-red-500">
          OPS
        </span>
      </div>
    </Link>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const isItemActive = (item: NavItem) => {
    if (item.href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/liveweb" || pathname === "/";
    }
    return pathname === item.href;
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 apt-scroll" aria-label="Main navigation">
      <div>
        <div className="mb-1.5 px-3 text-[10.5px] font-semibold tracking-wider text-zinc-500 uppercase">
          WORKSPACE
        </div>
        <div className="space-y-0.5">
          {WORKSPACE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[12.5px] font-medium transition-all duration-150",
                  active
                    ? "bg-red-950/40 text-red-400 border border-red-500/30 font-semibold shadow-[0_0_12px_rgba(239,68,68,0.12)]"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-red-500" : "text-zinc-400 group-hover:text-zinc-200",
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
                {item.pulse ? (
                  <span className="ml-auto flex size-2 items-center justify-center">
                    <span className="absolute size-2 rounded-full bg-red-500 animate-ping opacity-75" />
                    <span className="relative size-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = usePortal();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#12141c] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === "light" ? (
        <Sun className="size-3.5 text-amber-500" />
      ) : (
        <Moon className="size-3.5 text-sky-400" />
      )}
    </button>
  );
}

function SignOutButton() {
  const [loading, setLoading] = React.useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch {
      window.location.assign("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[#12141c] text-zinc-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-950/20 transition disabled:opacity-50"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="size-3.5" />
    </button>
  );
}

function ProfileSettingsModal({
  user,
  isOpen,
  onClose,
}: {
  user: SessionUser;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = React.useState(user.email || "");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ text: string; tone: "success" | "error" } | null>(null);

  if (!isOpen) return null;

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setStatusMessage({ text: "New passwords do not match.", tone: "error" });
      return;
    }
    if (newPassword && !currentPassword) {
      setStatusMessage({ text: "Please enter your current password to set a new password.", tone: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (email.trim() && email.trim() !== user.email) {
        payload.email = email.trim();
      }
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      if (Object.keys(payload).length === 0) {
        setStatusMessage({ text: "No changes to save.", tone: "error" });
        setLoading(false);
        return;
      }

      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setStatusMessage({ text: "Settings saved successfully! Reloading...", tone: "success" });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setStatusMessage({ text: errorMessage(err), tone: "error" });
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch {
      window.location.assign("/login");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0e14] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-red-950/60 border border-red-500/30 text-red-400">
              <Settings className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Account Settings</h3>
              <p className="text-[11px] text-zinc-400">Update work email and credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {statusMessage ? (
          <div className={`mt-4 p-3 rounded-lg text-xs font-medium border ${
            statusMessage.tone === "success"
              ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
              : "bg-red-950/40 text-red-300 border-red-500/30"
          }`}>
            {statusMessage.text}
          </div>
        ) : null}

        <form onSubmit={handleUpdate} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Work Email
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 size-3.5 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 rounded-lg bg-[#141722] border border-white/10 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                required
              />
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06]">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Change Password</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Current Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 size-3.5 text-zinc-500" />
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-9 rounded-lg bg-[#141722] border border-white/10 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3 size-3.5 text-zinc-500" />
                  <input
                    type="password"
                    placeholder="At least 12 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-9 rounded-lg bg-[#141722] border border-white/10 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3 size-3.5 text-zinc-500" />
                  <input
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-9 rounded-lg bg-[#141722] border border-white/10 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between gap-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 bg-red-950/20 text-xs font-medium text-red-400 hover:bg-red-950/40 transition disabled:opacity-50"
            >
              <LogOut className="size-3.5" />
              <span>{logoutLoading ? "Signing out..." : "Sign Out"}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-md transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InnerPortalLayout({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const initials = (user.name || "AA")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 transition-colors duration-150">
      <ProfileSettingsModal user={user} isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Top Header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#090a0f]/95 backdrop-blur-md px-3 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>

          <Brand />

          {/* Breadcrumb: Ops > Live Analytics */}
          <div className="hidden sm:flex items-center gap-2 pl-2 text-xs text-zinc-400">
            <span className="text-zinc-400">Ops</span>
            <ChevronRight className="size-3 text-zinc-500" />
            <span className="font-semibold text-zinc-200">Live Analytics</span>
          </div>
        </div>

        {/* Right Header items */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search bar */}
          <div className="relative hidden md:flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search anything..."
              className="h-8 w-56 lg:w-64 rounded-lg bg-[#11131a] border border-white/[0.08] pl-8 pr-7 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-red-500/40 transition"
            />
            <kbd className="absolute right-2 text-[10px] text-zinc-500 font-sans border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 rounded">
              /
            </kbd>
          </div>

          {/* Notification bell */}
          <button
            type="button"
            className="relative flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
          </button>

          {/* User profile */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-[#11131a] px-2.5 py-1 hover:border-red-500/30 hover:bg-[#161922] transition text-left cursor-pointer"
            title="Account Settings & Credentials"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-200">
              {initials}
            </div>
            <div className="min-w-0 leading-tight pr-1">
              <p className="max-w-[120px] truncate text-[11.5px] font-semibold text-zinc-100">
                {user.name || "Apthex Admin"}
              </p>
              <p className="font-sans text-[10px] text-red-500 font-medium">
                {ROLE_LABELS[user.accessLevel] ?? "Owner"}
              </p>
            </div>
            <Settings className="size-3.5 text-zinc-500 ml-0.5 hover:text-white" />
          </button>

          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-[215px] flex-col border-r border-white/[0.06] bg-[#090a0f] lg:flex">
        <NavLinks pathname={pathname} />

        {/* Bottom card: Private Workspace */}
        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="w-full text-left rounded-xl border border-white/[0.08] bg-[#0e1017] p-3 shadow-sm hover:border-red-500/30 hover:bg-[#131620] transition group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-red-500" />
                <p className="text-[11.5px] font-semibold text-zinc-100 group-hover:text-red-400 transition">Private Workspace</p>
              </div>
              <ArrowUpRight className="size-3 text-zinc-500 group-hover:text-zinc-300" />
            </div>
            <p className="mt-1 font-sans text-[10.5px] text-zinc-400 truncate">
              {user.email || "apthex@apthex.com"}
            </p>
          </button>
          <p className="mt-2.5 px-1 font-sans text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            APTHEX OPS · v2.4
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-white/10 bg-[#090a0f] shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setProfileOpen(true);
                }}
                className="mb-3 flex w-full items-center gap-2.5 text-left rounded-lg p-1.5 hover:bg-white/[0.05] transition"
              >
                <div className="flex size-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-200">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-100">{user.name}</p>
                  <p className="font-sans text-[10.5px] text-zinc-400 truncate">{user.email}</p>
                </div>
                <Settings className="size-3.5 text-zinc-500" />
              </button>
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <main className="pt-14 lg:pl-[215px]">
        <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1520px] px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PortalShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <PortalProvider user={user}>
      <React.Suspense fallback={<div className="p-8 text-zinc-500">Loading workspace...</div>}>
        <InnerPortalLayout user={user}>{children}</InnerPortalLayout>
      </React.Suspense>
    </PortalProvider>
  );
}
