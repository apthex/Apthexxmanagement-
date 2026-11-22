"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ChevronRight,
  Command,
  Download,
  Eye,
  FileCheck2,
  Layers,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { can, ROLE_LABELS, type Permission } from "@/lib/role-access";
import type { SessionUser } from "@/lib/portal-types";
import { Avatar } from "@/components/portal/ui";
import { PortalProvider, usePortal } from "@/components/portal/context";
import { Modal } from "@/components/ui/dialog";

type NavItem = {
  href: string;
  tabKey: string;
  label: string;
  icon: LucideIcon;
  pulse?: boolean;
};

const ANALYTICS_NAV: NavItem[] = [
  { href: "/dashboard", tabKey: "overview", label: "Live Analytics", icon: Activity, pulse: true },
  { href: "/dashboard?tab=live", tabKey: "live", label: "Live Active", icon: Eye, pulse: true },
  { href: "/dashboard?tab=visitors", tabKey: "visitors", label: "Visitors", icon: Users },
  { href: "/dashboard?tab=pages", tabKey: "pages", label: "Pages", icon: FileCheck2 },
  { href: "/dashboard?tab=sources", tabKey: "sources", label: "Sources", icon: Layers },
];

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red/40"
      aria-label="Apthex Analytics Workspace"
    >
      <span className="relative flex size-7.5 items-center justify-center rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-4 fill-current text-white dark:text-zinc-950" aria-hidden>
          <path d="M12 3L2 21h20L12 3zm0 5.5l5.5 10h-11L12 8.5z" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red ring-2 ring-white dark:ring-zinc-950" />
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[16px] font-bold tracking-tight text-ink dark:text-white">
          APTHEX
        </span>
        <span className="font-sans text-[10.5px] font-semibold uppercase tracking-wider text-red">
          ANALYTICS
        </span>
      </div>
    </Link>
  );
}

function NavLinks({
  currentTab,
  onNavigate,
}: {
  currentTab: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 apt-scroll" aria-label="Main navigation">
      <div className="mb-2 px-2.5 text-[11px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
        // ANALYTICS
      </div>
      <div className="space-y-1">
        {ANALYTICS_NAV.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.tabKey;
          return (
            <Link
              key={item.tabKey}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-9.5 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-red/[0.12] text-red border border-red/25 dark:bg-red/[0.16] font-semibold shadow-sm"
                  : "text-zinc-600 hover:bg-black/[0.04] hover:text-ink dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100",
              )}
            >
              {active ? (
                <span
                  className="absolute -left-3 h-5 w-[3px] rounded-r bg-red shadow-[0_0_8px_rgba(225,29,46,0.6)]"
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-red" : "text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300",
                )}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
              {item.pulse ? (
                <span className="ml-auto flex size-2 items-center justify-center">
                  <span className="absolute size-2 rounded-full bg-red animate-ping opacity-75" />
                  <span className="relative size-1.5 rounded-full bg-red shadow-[0_0_6px_#E11D2E]" />
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Clock() {
  const [time, setTime] = React.useState("");
  React.useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
    setTime(format());
    const timer = window.setInterval(() => setTime(format()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="hidden items-center gap-2 rounded-lg border border-line dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-sans text-zinc-600 dark:text-zinc-400 lg:flex shadow-sm tabular-nums"
      title="Indian Standard Time"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span>{time || "12:00"} IST</span>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = usePortal();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative flex size-8.5 items-center justify-center rounded-lg border border-line dark:border-white/10 bg-white/70 dark:bg-[#16161D] text-zinc-600 dark:text-zinc-300 shadow-sm transition-all hover:bg-zinc-100 dark:hover:bg-white/[0.08] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/30"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Sun className="size-4 text-amber-600 transition-transform hover:rotate-45" aria-hidden />
      ) : (
        <Moon className="size-4 text-sky-400 transition-transform hover:-rotate-12" aria-hidden />
      )}
    </button>
  );
}

function SignOutButton({ compact }: { compact?: boolean }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function signOut() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch (signOutError) {
      setError(errorMessage(signOutError));
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={signOut}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-line dark:border-white/10 bg-white/70 dark:bg-[#16161D] text-zinc-600 dark:text-zinc-300 shadow-sm transition-all hover:bg-red-50 dark:hover:bg-red/10 hover:text-red hover:border-red/30 active:scale-95 disabled:opacity-50",
          compact ? "size-8.5 justify-center" : "h-8.5 px-3 text-[12px] font-medium",
        )}
        aria-label="Sign out"
        title="Sign out of Apthex"
      >
        <LogOut className="size-3.5" aria-hidden />
        {compact ? null : <span>Sign out</span>}
      </button>
      {error ? (
        <span className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-red-200 bg-white p-2 text-[11px] text-red shadow-float">
          {error}
        </span>
      ) : null}
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
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, currentTab]);

  const activeLabel =
    ANALYTICS_NAV.find((item) => item.tabKey === currentTab)?.label ?? "Live Analytics";

  return (
    <div className="min-h-screen bg-wash text-ink transition-colors duration-150">
      {/* Top Header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-line dark:border-white/[0.08] bg-[#FAF9F5]/90 dark:bg-[#101014]/95 backdrop-blur-md px-3 sm:px-5">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="mr-2.5 flex size-8 items-center justify-center rounded-lg border border-line dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] lg:hidden"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
        >
          <Menu className="size-4" aria-hidden />
        </button>

        <Brand />

        <div className="ml-4 hidden items-center gap-1.5 font-sans text-[12px] text-zinc-400 dark:text-zinc-500 xl:flex">
          <ChevronRight className="size-3 text-red" aria-hidden />
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">{activeLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Clock />
          <ThemeToggle />

          <span className="hidden h-4 w-px bg-line dark:bg-white/10 sm:block" />

          {/* User profile pill */}
          <div className="flex items-center gap-2 rounded-lg border border-line dark:border-white/10 bg-white/60 dark:bg-[#16161D] px-2.5 py-1 shadow-sm">
            <Avatar name={user.name} size="xs" />
            <div className="min-w-0 leading-tight">
              <p className="max-w-[120px] truncate text-[12px] font-semibold text-ink dark:text-zinc-100">
                {user.name}
              </p>
              <p className="font-sans text-[10px] uppercase tracking-wider text-red font-medium">
                {ROLE_LABELS[user.accessLevel] ?? "Owner"}
              </p>
            </div>
          </div>

          <SignOutButton compact />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-[230px] flex-col border-r border-line dark:border-white/[0.08] bg-[#FAF9F6]/85 dark:bg-[#101014] backdrop-blur-md lg:flex">
        <NavLinks currentTab={currentTab} />

        <div className="border-t border-line dark:border-white/[0.08] p-3.5">
          <div className="rounded-xl border border-line dark:border-white/10 bg-white/80 dark:bg-[#14141A] p-3 shadow-card">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-[11.5px] font-semibold text-ink dark:text-zinc-100">Private Workspace</p>
            </div>
            <p className="mt-1 font-sans text-[11px] leading-4 text-zinc-500 dark:text-zinc-400 truncate">
              {user.email}
            </p>
          </div>
          <p className="mt-2.5 px-1 font-sans text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium">
            APTHEX ANALYTICS · v2.4
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-line dark:border-white/10 bg-[#FAF9F6] dark:bg-[#101014] shadow-float animate-slide-in-right">
            <div className="flex h-14 items-center justify-between border-b border-line dark:border-white/10 px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-line dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08]"
                aria-label="Close navigation"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <NavLinks currentTab={currentTab} onNavigate={() => setDrawerOpen(false)} />
            <div className="border-t border-line dark:border-white/10 p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar name={user.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-ink dark:text-zinc-100">{user.name}</p>
                  <p className="font-sans text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <main className="pt-14 lg:pl-[230px]">
        <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1520px] px-4 py-6 sm:px-7 sm:py-8">
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
