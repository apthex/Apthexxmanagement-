"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Flame,
  ListChecks,
  NotebookPen,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import { formatInrCompact } from "@/lib/format";
import { formatIstDate, relativeDays } from "@/lib/dates";
import type { DashboardData } from "@/lib/portal-types";
import { usePortal } from "@/components/portal/context";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  InlineAlert,
  PageHeader,
  SectionHeader,
  StatCard,
  TableSkeleton,
} from "@/components/portal/ui";
import { StatusBadge } from "@/components/ui/badge";

const STAGES = [
  { key: "identified", label: "Identified", color: "bg-zinc-400 dark:bg-zinc-600" },
  { key: "talking", label: "Talking", color: "bg-sky-500" },
  { key: "pitched", label: "Pitched", color: "bg-zinc-800 dark:bg-zinc-200" },
  { key: "won", label: "Won", color: "bg-emerald-500" },
  { key: "lost", label: "Lost", color: "bg-red" },
] as const;

function nameOnly(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

function taskTone(status: string) {
  if (status === "blocked") return "bg-warn shadow-[0_0_6px_rgba(154,100,0,0.4)]";
  if (status === "in_progress") return "bg-info shadow-[0_0_6px_rgba(35,85,184,0.4)]";
  if (status === "done") return "bg-ok shadow-[0_0_6px_rgba(21,123,65,0.4)]";
  return "bg-zinc-300 dark:bg-zinc-600";
}

export function DashboardClient() {
  const { user, can } = usePortal();
  const { data, loading, error, reload } = useApi<DashboardData>("/api/dashboard");

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-8 w-64 rounded-lg dark:bg-white/[0.06]" />
          <div className="skeleton h-4 w-96 max-w-full rounded-md dark:bg-white/[0.06]" />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-[124px] rounded-xl dark:bg-white/[0.06]" />
          ))}
        </div>
        <Card className="p-4">
          <TableSkeleton rows={5} cols={3} />
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader eyebrow="Overview" title={`Welcome back, ${nameOnly(user.name)}.`} />
        <ErrorState message={error ?? "Dashboard data is currently unavailable."} onRetry={() => void reload()} />
      </>
    );
  }

  const owner = data.owner;
  const tasks = data.myTasks.filter((task) => task.status !== "done");
  const showWorkLogCta = can("worklogs.write_own");
  const showTaskCta = can("tasks.create");
  const showLeadCta = can("leads.write");
  const stageTotal = STAGES.reduce((sum, stage) => sum + (owner?.leadsByStage[stage.key] ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${nameOnly(user.name)}.`}
        description={`${formatIstDate(data.today)} · Operations cycle ${formatIstDate(data.weekStart)} – ${formatIstDate(data.weekEnd)}. Here is your live command deck.`}
        actions={
          <>
            {showWorkLogCta && !data.loggedToday ? (
              <Link
                href="/worklogs"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line dark:border-white/10 bg-white/90 dark:bg-[#16161D] px-3.5 text-[12.5px] font-medium text-ink dark:text-zinc-200 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-white/[0.08]"
              >
                <NotebookPen className="size-3.5 text-zinc-500" aria-hidden /> Log today
              </Link>
            ) : null}
            {showTaskCta ? (
              <Link
                href="/tasks"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line dark:border-white/10 bg-white/90 dark:bg-[#16161D] px-3.5 text-[12.5px] font-medium text-ink dark:text-zinc-200 shadow-sm transition hover:bg-zinc-50 dark:hover:bg-white/[0.08]"
              >
                <Plus className="size-3.5 text-zinc-500" aria-hidden /> New task
              </Link>
            ) : null}
            {showLeadCta ? (
              <Link
                href="/leads"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red px-4 text-[12.5px] font-medium text-white shadow-sm transition hover:bg-red-dark active:scale-[0.98]"
              >
                <UserPlus className="size-3.5" aria-hidden /> New lead
              </Link>
            ) : null}
          </>
        }
      />

      {/* Unfiled Work Log Warning Banner */}
      {!data.loggedToday && showWorkLogCta ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <Clock3 className="size-4" aria-hidden />
            </span>
            <span>
              Today&apos;s daily work log is missing. Submission closes strictly at <strong>midnight IST</strong>.
            </span>
          </div>
          <Link
            href="/worklogs"
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600/15 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200 hover:bg-amber-600/25 transition"
          >
            File now <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      ) : null}

      {/* 4 Refined KPI Cards */}
      {owner ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Leads in play"
            value={owner.leadsInPlay}
            icon={Target}
            accent="red"
            meta={`${owner.leadsByStage.won ?? 0} won · ${owner.leadsByStage.lost ?? 0} lost`}
            href={
              <Link
                href="/leads"
                className="flex items-center gap-1 font-mono text-[11px] font-medium text-zinc-500 hover:text-red transition-colors"
              >
                Pipeline <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          <StatCard
            label="Active clients"
            value={owner.activeClients}
            icon={Building2}
            accent="blue"
            meta="Active engagements"
            href={
              <Link
                href="/clients"
                className="flex items-center gap-1 font-mono text-[11px] font-medium text-zinc-500 hover:text-sky-500 transition-colors"
              >
                Directory <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          <StatCard
            label={`Net · ${owner.finance.monthLabel.split(" ")[0]}`}
            value={formatInrCompact(owner.finance.netPaise)}
            icon={owner.finance.netPaise >= 0 ? TrendingUp : TrendingDown}
            accent={owner.finance.netPaise >= 0 ? "green" : "red"}
            meta={`In ${formatInrCompact(owner.finance.inPaise)} · Out ${formatInrCompact(owner.finance.outPaise)}`}
            href={
              <Link
                href="/finance"
                className="flex items-center gap-1 font-mono text-[11px] font-medium text-zinc-500 hover:text-emerald-500 transition-colors"
              >
                Ledger <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
          <StatCard
            label="Active team"
            value={owner.teamCount}
            icon={Users}
            accent="amber"
            meta="Security & operations crew"
            href={
              <Link
                href="/members"
                className="flex items-center gap-1 font-mono text-[11px] font-medium text-zinc-500 hover:text-amber-500 transition-colors"
              >
                Roster <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="My open tasks" value={data.openTaskCount} icon={ListChecks} accent="blue" meta="Assigned to your queue" />
          <StatCard
            label="Due today"
            value={data.dueToday.length}
            icon={Clock3}
            accent={data.dueToday.length ? "amber" : "green"}
            meta={data.dueToday.length ? "Action required" : "Zero blockers due"}
          />
          <StatCard label="Meetings this week" value={data.meetingsThisWeek.length} icon={CalendarDays} accent="default" meta="Confirmed sessions" />
          <StatCard
            label="Today's work log"
            value={data.loggedToday ? "Filed" : "Pending"}
            icon={data.loggedToday ? CheckCircle2 : NotebookPen}
            accent={data.loggedToday ? "green" : "red"}
            meta={data.loggedToday ? "Recorded for today" : "Due by midnight IST"}
          />
        </div>
      )}

      {/* Main Content Layout: 2-Column Responsive Grid */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
        {/* Left Column: Tasks and Lead Pipeline */}
        <div className="space-y-6">
          {/* My Tasks Card */}
          <Card>
            <SectionHeader
              title="My Tasks"
              description={tasks.length ? `${tasks.length} active assignments in your queue` : "Queue clear"}
              action={
                <Link
                  href="/tasks"
                  className="font-mono text-[11.5px] font-medium text-zinc-500 hover:text-red transition-colors"
                >
                  View all tasks →
                </Link>
              }
            />
            {tasks.length ? (
              <ul className="divide-y divide-zinc-100 dark:divide-white/[0.05]">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="group flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]"
                  >
                    <span className={`size-2.5 shrink-0 rounded-full ${taskTone(task.status)}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href="/tasks" className="block">
                        <p className="truncate text-[13px] font-medium text-ink dark:text-zinc-100 group-hover:text-red transition-colors">
                          {task.title}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {task.clientName ? (
                            <span className="text-zinc-700 dark:text-zinc-300 font-sans">{task.clientName}</span>
                          ) : (
                            <span className="text-zinc-400">Internal</span>
                          )}
                          <span aria-hidden>·</span>
                          <span className={task.dueOn && task.dueOn < data.today ? "font-bold text-red" : ""}>
                            {task.dueOn ? relativeDays(task.dueOn) : "No deadline"}
                          </span>
                        </p>
                      </Link>
                    </div>
                    <StatusBadge value={task.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={CheckCircle2}
                title="All caught up"
                description="No outstanding tasks assigned to you right now."
              />
            )}
          </Card>

          {/* Lead Pipeline Card */}
          {owner ? (
            <Card>
              <SectionHeader
                title="Lead Pipeline"
                description={`${stageTotal} opportunities tracked across the operational funnel`}
                action={
                  <Link
                    href="/leads"
                    className="font-mono text-[11.5px] font-medium text-zinc-500 hover:text-red transition-colors"
                  >
                    Open board →
                  </Link>
                }
              />
              <div className="space-y-4 px-5 py-5">
                {STAGES.map((stage) => {
                  const count = owner.leadsByStage[stage.key] ?? 0;
                  const pct = stageTotal ? Math.round((count / stageTotal) * 100) : 0;
                  return (
                    <div key={stage.key} className="grid grid-cols-[85px_1fr_40px] items-center gap-3">
                      <span className="font-mono text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
                        {stage.label}
                      </span>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${stage.color}`}
                          style={{ width: `${Math.max(pct, count ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-[11.5px] font-semibold tabular-nums text-ink dark:text-zinc-200">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>

        {/* Right Column: Meetings and Quick Actions */}
        <div className="space-y-6">
          {/* Meetings This Week Card */}
          <Card>
            <SectionHeader
              title="Meetings This Week"
              description={`${formatIstDate(data.weekStart)} – ${formatIstDate(data.weekEnd)}`}
              action={
                <Link
                  href="/meetings"
                  className="font-mono text-[11.5px] font-medium text-zinc-500 hover:text-red transition-colors"
                >
                  Schedule →
                </Link>
              }
            />
            {data.meetingsThisWeek.length ? (
              <ul className="divide-y divide-zinc-100 dark:divide-white/[0.05]">
                {data.meetingsThisWeek.slice(0, 5).map((meeting) => (
                  <li key={meeting.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-line dark:border-white/10 bg-zinc-50 dark:bg-[#16161D] py-1 shadow-sm">
                      <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                        {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short" }).format(
                          new Date(`${meeting.heldOn}T00:00:00+05:30`),
                        )}
                      </span>
                      <span className="font-display text-[15px] font-bold leading-tight text-ink dark:text-white">
                        {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit" }).format(
                          new Date(`${meeting.heldOn}T00:00:00+05:30`),
                        )}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink dark:text-zinc-100">{meeting.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {relativeDays(meeting.heldOn)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={CalendarDays}
                title="Calendar clear"
                description="No upcoming sessions scheduled for this week."
              />
            )}
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <SectionHeader title="Quick Actions" description="Fast operational shortcuts" />
            <div className="grid grid-cols-2 gap-2.5 p-3.5">
              {[
                { href: "/leads", label: "Pipeline", icon: Target, show: can("leads.read") },
                { href: "/clients", label: "Clients", icon: Building2, show: can("clients.read") },
                { href: "/tasks", label: "Tasks", icon: ListChecks, show: can("tasks.read") },
                { href: "/worklogs", label: "Work Log", icon: NotebookPen, show: can("worklogs.write_own") },
                { href: "/meetings", label: "Meetings", icon: CalendarDays, show: can("meetings.read") },
                { href: "/finance", label: "Finance", icon: Wallet, show: can("finance.read") },
              ]
                .filter((item) => item.show)
                .slice(0, 6)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-2.5 rounded-lg border border-line dark:border-white/10 bg-white/70 dark:bg-[#16161D] px-3.5 py-3 shadow-sm transition hover:border-black/20 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/[0.06]"
                    >
                      <Icon className="size-4 text-zinc-400 group-hover:text-red transition-colors" aria-hidden />
                      <span className="text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-ink dark:group-hover:text-white transition-colors">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </Card>

          {!data.loggedToday && !showWorkLogCta ? (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[12px] font-medium text-zinc-500">
                <Circle className="size-2 fill-zinc-300 text-zinc-300" aria-hidden /> Work logs are restricted to your role.
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Bottom Roll-Up Footer Strip */}
      {owner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line dark:border-white/[0.08] bg-white/80 dark:bg-[#131318] px-5 py-3.5 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="sm" />
            <p className="text-[12.5px] text-zinc-600 dark:text-zinc-400">
              Authenticated as <span className="font-semibold text-ink dark:text-white">{user.roleTitle || "Owner"}</span>. Next weekly roll-up window begins{" "}
              <span className="font-mono font-medium text-ink dark:text-zinc-200">{formatIstDate(data.nextWeekStart)}</span>.
            </p>
          </div>
          <Link
            href="/liveweb"
            className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-red hover:underline underline-offset-4"
          >
            Live Web Telemetry <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
