"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronRight,
  Command,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  ScrollText,
  Search,
  ShieldCheck,
  Sun,
  Target,
  Users,
  Wallet,
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
  label: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
};

const WORKSPACE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", exact: true },
  { href: "/leads", label: "Leads", icon: Target, permission: "leads.read" },
  { href: "/clients", label: "Clients", icon: Building2, permission: "clients.read" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, permission: "tasks.read" },
  { href: "/worklogs", label: "Work Logs", icon: NotebookPen, permission: "worklogs.write_own" },
  { href: "/meetings", label: "Meetings", icon: CalendarDays, permission: "meetings.read" },
];

const COMPANY_NAV: NavItem[] = [
  { href: "/finance", label: "Finance", icon: Wallet, permission: "finance.read" },
  { href: "/members", label: "Members", icon: Users, permission: "members.read" },
  { href: "/audit", label: "Audit", icon: ScrollText, permission: "audit.read" },
  { href: "/liveweb", label: "LiveWeb", icon: Activity, permission: "liveweb.read" },
];

function visible(items: NavItem[], allowed: (permission: Permission) => boolean) {
  return items.filter((item) => allowed(item.permission));
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red/40"
      aria-label="Apthex Internal Operations"
    >
      <span className="relative flex size-7.5 items-center justify-center rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-4 fill-current text-white dark:text-zinc-950" aria-hidden>
          <path d="M12 3L2 21h20L12 3zm0 5.5l5.5 10h-11L12 8.5z" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red ring-2 ring-white dark:ring-zinc-950" />
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[16px] font-bold tracking-tight text-ink dark:text-white">
          APTHEX
        </span>
        <span className="hidden font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-red sm:inline-block">
          // OPS
        </span>
      </div>
    </Link>
  );
}

function NavLinks({
  allowed,
  pathname,
  onNavigate,
}: {
  allowed: (permission: Permission) => boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const workspace = visible(WORKSPACE_NAV, allowed);
  const company = visible(COMPANY_NAV, allowed);
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 apt-scroll" aria-label="Main navigation">
      {workspace.length ? (
        <NavGroup label="// WORKSPACE">
          {workspace.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
          ))}
        </NavGroup>
      ) : null}
      {company.length ? (
        <NavGroup label="// COMPANY" className="mt-6">
          {company.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
          ))}
        </NavGroup>
      ) : null}
    </nav>
  );
}

function NavGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2 px-2.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-red/[0.08] text-red dark:bg-red/[0.14] dark:text-red font-semibold"
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
      <span>{item.label}</span>
    </Link>
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
      className="hidden items-center gap-2 rounded-lg border border-line dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-mono text-zinc-600 dark:text-zinc-400 lg:flex shadow-sm"
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

function GlobalSearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-8.5 items-center gap-2 rounded-lg border border-line dark:border-white/10 bg-white/70 dark:bg-[#15151B] px-3 text-[12px] text-zinc-500 dark:text-zinc-400 shadow-sm transition hover:border-black/20 dark:hover:border-white/20 hover:text-ink dark:hover:text-zinc-200"
      aria-label="Search workspace (Cmd+K)"
      title="Search workspace (Cmd+K)"
    >
      <Search className="size-3.5 text-zinc-400" aria-hidden />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden font-mono text-[10px] text-zinc-400 dark:text-zinc-500 sm:inline-flex items-center gap-0.5 rounded border border-line dark:border-white/10 bg-zinc-100 dark:bg-white/[0.06] px-1.5 py-0.5">
        <Command className="size-2.5" /> K
      </kbd>
    </button>
  );
}

function QuickSearchModal({
  open,
  onOpenChange,
  allowed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowed: (permission: Permission) => boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const allItems = React.useMemo(() => {
    return [...visible(WORKSPACE_NAV, allowed), ...visible(COMPANY_NAV, allowed)];
  }, [allowed]);

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [allItems, query]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Navigation"
      description="Jump directly to any operational workspace or tool."
      size="md"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type page name (e.g. leads, finance, tasks)..."
            className="h-10 w-full rounded-lg border border-line dark:border-white/10 bg-zinc-50 dark:bg-[#15151B] pl-9.5 pr-3 text-[13px] text-ink dark:text-white outline-none focus:border-red/60 focus:ring-2 focus:ring-red/20"
          />
        </div>

        <div className="space-y-1 max-h-[300px] overflow-y-auto apt-scroll">
          {filtered.length ? (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleSelect(item.href)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-ink dark:hover:text-white group"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 text-zinc-400 group-hover:text-red transition-colors" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <ChevronRight className="size-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              );
            })
          ) : (
            <p className="py-6 text-center text-[12.5px] text-zinc-500">No destinations found for &quot;{query}&quot;</p>
          )}
        </div>
      </div>
    </Modal>
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
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { can: allowed } = usePortal();

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const current =
    [...WORKSPACE_NAV, ...COMPANY_NAV].find((item) => isActive(pathname, item))?.label ?? "Overview";

  return (
    <div className="min-h-screen bg-wash text-ink transition-colors duration-150">
      {/* Top Navigation */}
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

        <div className="ml-4 hidden items-center gap-1.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500 xl:flex">
          <ChevronRight className="size-3 text-red" aria-hidden />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{current}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <GlobalSearchTrigger onOpen={() => setSearchOpen(true)} />
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
              <p className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-red font-medium">
                {ROLE_LABELS[user.accessLevel] ?? "Member"}
              </p>
            </div>
          </div>

          <SignOutButton compact />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-[240px] flex-col border-r border-line dark:border-white/[0.08] bg-[#FAF9F6]/85 dark:bg-[#101014] backdrop-blur-md lg:flex">
        <NavLinks allowed={allowed} pathname={pathname} />

        <div className="border-t border-line dark:border-white/[0.08] p-3.5">
          <div className="rounded-xl border border-line dark:border-white/10 bg-white/80 dark:bg-[#14141A] p-3 shadow-card">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="text-[11px] font-semibold text-ink dark:text-zinc-100">Private Workspace</p>
            </div>
            <p className="mt-1 font-mono text-[10px] leading-4 text-zinc-500 dark:text-zinc-400 truncate">
              {user.email}
            </p>
            <p className="mt-0.5 text-[9.5px] text-zinc-400 dark:text-zinc-500">
              Audit trail strictly enforced
            </p>
          </div>
          <p className="mt-2.5 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-600">
            APTHEX · INTERNAL v2.4
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
          <div className="absolute inset-y-0 left-0 flex w-[285px] flex-col border-r border-line dark:border-white/10 bg-[#FAF9F6] dark:bg-[#101014] shadow-float animate-slide-in-right">
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
            <NavLinks allowed={allowed} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <div className="border-t border-line dark:border-white/10 p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar name={user.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-ink dark:text-zinc-100">{user.name}</p>
                  <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Search Dialog */}
      <QuickSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        allowed={allowed}
      />

      {/* Main Content Area */}
      <main className="pt-14 lg:pl-[240px]">
        <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1480px] px-4 py-6 sm:px-7 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PortalShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <PortalProvider user={user}>
      <InnerPortalLayout user={user}>{children}</InnerPortalLayout>
    </PortalProvider>
  );
}
