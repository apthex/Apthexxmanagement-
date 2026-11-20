"use client";

import * as React from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  LockKeyhole,
  NotebookPen,
  Pencil,
  Plus,
  TimerReset,
  Users,
} from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { addDays, daysBetweenInclusive, formatIstDate, relativeDays, weekRange } from "@/lib/dates";
import { todayIst } from "@/lib/format";
import type { TaskRow, WorkLogRow, WorkLogsData } from "@/lib/portal-types";
import { usePortal } from "@/components/portal/context";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
  InlineAlert,
  PageHeader,
  Stars,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

function LogForm({
  today,
  tasks,
  initial,
  onClose,
  onSaved,
}: {
  today: string;
  tasks: TaskRow[];
  initial?: WorkLogRow;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [summary, setSummary] = React.useState(initial?.summary ?? "");
  const [hours, setHours] = React.useState(initial?.hours ?? "");
  const [taskIds, setTaskIds] = React.useState<string[]>(initial?.taskIds ?? []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  const sortedTasks = React.useMemo(
    () => [...tasks].sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.title.localeCompare(b.title)),
    [tasks],
  );

  function toggleTask(taskId: string) {
    setTaskIds((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(hours) || Number(hours) <= 0 || Number(hours) > 24) {
      setFields({ hours: "Enter hours between 0 and 24, with up to two decimals." });
      return;
    }
    if (summary.trim().length < 3) {
      setFields({ summary: "Add at least a short description." });
      return;
    }
    setLoading(true);
    try {
      if (initial) {
        await apiFetch(`/api/worklogs/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify({ summary: summary.trim(), hours, taskIds }),
        });
        onSaved("Work log updated.");
      } else {
        await apiFetch("/api/worklogs", {
          method: "POST",
          body: JSON.stringify({ logDate: today, summary: summary.trim(), hours, taskIds }),
        });
        onSaved("Work log filed.");
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
      setFields(fieldErrors(submitError));
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={initial ? "Edit today's work log" : "File today's work log"}
      description={`${formatIstDate(today)} · One entry per member per day. Past days are locked.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="worklog-form" variant="primary" loading={loading}>
            {initial ? "Save changes" : "File work log"}
          </Button>
        </>
      }
    >
      <form id="worklog-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        <Field label="What did you work on?" htmlFor="log-summary" error={fields.summary} required>
          <Textarea
            id="log-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="A clear record of the day: outcomes, blockers, decisions…"
            className="min-h-[110px]"
            required
          />
        </Field>
        <Field label="Hours worked" htmlFor="log-hours" error={fields.hours} hint="Between 0 and 24, up to two decimals." required>
          <div className="relative">
            <Clock3 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Input
              id="log-hours"
              inputMode="decimal"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              placeholder="8"
              className="pl-9"
              required
            />
          </div>
        </Field>
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-zinc-700">Linked tasks</p>
          <p className="mb-2 text-[10.5px] text-zinc-500">Only your own tasks can be linked. Optional.</p>
          {sortedTasks.length ? (
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-line p-2 apt-scroll">
              {sortedTasks.map((task) => (
                <label key={task.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11.5px] hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={taskIds.includes(task.id)}
                    onChange={() => toggleTask(task.id)}
                    className="size-3.5 rounded border-line accent-red"
                  />
                  <span className={cn("min-w-0 flex-1 truncate", task.status === "done" ? "text-zinc-400 line-through" : "text-zinc-600")}>
                    {task.title}
                  </span>
                  {task.clientName ? <span className="shrink-0 text-[9.5px] text-zinc-400">{task.clientName}</span> : null}
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[10.5px] text-zinc-400">No tasks assigned to you.</p>
          )}
        </div>
      </form>
    </Modal>
  );
}

function DayStrip({ days, member, today }: { days: string[]; member: WorkLogsData["members"][number]; today: string }) {
  const byDay = new Map(member.logs.map((log) => [log.logDate, log]));
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const entry = byDay.get(day);
        const future = day > today;
        const missing = member.missingDays.includes(day);
        const weekday = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "narrow" }).format(new Date(`${day}T00:00:00Z`));
        return (
          <div
            key={day}
            className={cn(
              "rounded-md border px-1 py-1.5 text-center",
              future
                ? "border-zinc-100 bg-zinc-50/50 text-zinc-300"
                : entry
                  ? "border-green-100 bg-green-50/60 text-ok"
                  : missing
                    ? "border-red-100 bg-red-50/50 text-red"
                    : "border-zinc-100 bg-zinc-50 text-zinc-400",
            )}
            title={entry ? `${day}: ${entry.hours} hours` : missing ? `${day}: missing` : `${day}: no entry`}
          >
            <p className="text-[8.5px] font-medium uppercase">{weekday}</p>
            <p className="mt-0.5 text-[9.5px] font-semibold tabular-nums">
              {entry ? `${entry.hours}h` : future ? "·" : missing ? "!" : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function WorkLogsClient() {
  const { user, can } = usePortal();
  const [weekAnchor, setWeekAnchor] = React.useState(todayIst());
  const { data, loading, error, reload } = useApi<WorkLogsData>(`/api/worklogs?week=${weekAnchor}`);
  const tasksApi = useApi<{ tasks: TaskRow[]; count: number }>("/api/tasks");
  const [form, setForm] = React.useState<{ mode: "create" } | { mode: "edit"; log: WorkLogRow } | null>(null);
  const [ratingBusy, setRatingBusy] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const today = data?.today ?? todayIst();
  const currentWeek = weekRange(today);
  const myEntry = data?.members.find((member) => member.memberId === user.id);
  const myTodayLog = myEntry?.logs.find((log) => log.logDate === today);
  const myTasks = (tasksApi.data?.tasks ?? []).filter((task) => task.assigneeMemberId === user.id);
  const taskMap = new Map((tasksApi.data?.tasks ?? []).map((task) => [task.id, task]));
  const weekDays = data ? daysBetweenInclusive(data.weekStart, data.weekEnd) : [];
  const canRate = data?.canRate ?? can("worklogs.rate");
  const allLogs = data?.members.flatMap((member) => member.logs) ?? [];
  const totalHours = Math.round(allLogs.reduce((sum, log) => sum + Number(log.hours), 0) * 100) / 100;
  const missingDays = data?.members.reduce((sum, member) => sum + member.missingDays.length, 0) ?? 0;
  const ratings = allLogs.map((log) => log.rating).filter((rating): rating is number => typeof rating === "number");
  const averageRating = ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null;
  const isCurrentWeek = data ? data.weekStart === currentWeek.start : true;

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function rate(logId: string, rating: number | null) {
    setRatingBusy(logId);
    setActionError(null);
    try {
      await apiFetch(`/api/worklogs/${logId}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });
      setNotice("Rating saved.");
      void reload(true);
    } catch (submitError) {
      setActionError(errorMessage(submitError));
    } finally {
      setRatingBusy(null);
    }
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader eyebrow="Team" title="Work Logs" description="A weekly record of what was done, how long it took, and how it landed." />
        <Card><TableSkeleton rows={7} cols={4} /></Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader eyebrow="Team" title="Work Logs" />
        <ErrorState message={error ?? "Work logs are unavailable."} onRetry={() => void reload()} />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Work Logs"
        description={canRate ? "Weekly delivery record for the whole team. Owners rate individual entries." : "Your daily record of what you worked on and how long it took."}
        actions={
          !myTodayLog ? (
            <Button variant="primary" onClick={() => setForm({ mode: "create" })}>
              <Plus className="size-3.5" aria-hidden /> File today&apos;s log
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setForm({ mode: "edit", log: myTodayLog })}>
              <Pencil className="size-3.5" aria-hidden /> Edit today&apos;s log
            </Button>
          )
        }
      />

      {notice ? <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert> : null}
      {actionError ? <InlineAlert tone="error" className="mb-4">{actionError}</InlineAlert> : null}

      <Card className="mb-4 flex flex-wrap items-center gap-3 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekAnchor(addDays(data.weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <div className="min-w-[190px] text-center">
            <p className="font-mono text-[12px] font-semibold text-ink dark:text-white">
              {formatIstDate(data.weekStart)} – {formatIstDate(data.weekEnd)}
            </p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
              {isCurrentWeek ? "This week" : "Past week"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={isCurrentWeek}
            onClick={() => setWeekAnchor(addDays(data.weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        {!isCurrentWeek ? (
          <Button variant="outline" size="sm" onClick={() => setWeekAnchor(today)}>
            This week
          </Button>
        ) : null}
        <p className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
          <LockKeyhole className="size-3 text-red" aria-hidden /> Entries lock strictly after midnight IST
        </p>
      </Card>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: canRate ? "Team hours" : "Your hours",
            value: totalHours ? `${totalHours}h` : "0h",
            note: canRate ? `${data.members.filter((member) => member.totalHours > 0).length} people logged` : "This week",
            icon: Clock3,
          },
          { label: "Entries filed", value: allLogs.length, note: "This week", icon: NotebookPen },
          {
            label: canRate ? "Missing weekdays" : "Your missing days",
            value: missingDays,
            note: missingDays ? "Visible in the day strips" : "All weekdays covered",
            icon: TimerReset,
          },
          canRate
            ? { label: "Average rating", value: averageRating ? `${averageRating}/5` : "—", note: `${ratings.length} rated entries`, icon: CheckCircle2 }
            : { label: "Today's log", value: myTodayLog ? "Filed" : "Pending", note: myTodayLog ? `${myTodayLog.hours} hours recorded` : "Due before midnight", icon: CalendarCheck2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="flex items-center justify-between p-4">
              <div>
                <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
                <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{item.note}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 text-zinc-400 dark:text-zinc-500" aria-hidden />
                <p className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink dark:text-white">{item.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {!myTodayLog ? (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-red-200/80 bg-red-50/50 dark:border-red/30 dark:bg-red/10 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <NotebookPen className="mt-0.5 size-4 text-red" aria-hidden />
            <div>
              <p className="text-[12.5px] font-medium text-ink dark:text-zinc-100">Today&apos;s work log is not filed.</p>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">It can only be added today ({formatIstDate(today)}). After midnight, the day locks.</p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setForm({ mode: "create" })}>
            <Plus className="size-3.5" aria-hidden /> File now
          </Button>
        </Card>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
            {canRate ? "Team roll-up" : "Weekly record"}
          </h2>
          <p className="text-[10.5px] text-zinc-400">{isCurrentWeek ? "Updates as entries are filed" : "Locked week"}</p>
        </div>

        {!data.members.length ? (
          <Card>
            <EmptyState icon={Users} title="No active members" description="There are no active team members eligible for work logs." />
          </Card>
        ) : (
          <div className={cn("grid items-start gap-4", canRate ? "xl:grid-cols-2" : "")}>
            {data.members.map((member) => {
              const isMe = member.memberId === user.id;
              return (
                <Card key={member.memberId} className={isMe ? "ring-1 ring-ink/5" : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={member.name} size="md" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                          {member.name}
                          {isMe ? <span className="rounded bg-zinc-100 px-1 py-0.5 text-[8.5px] font-medium uppercase tracking-[0.08em] text-zinc-500">You</span> : null}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500">{member.roleTitle || "Apthex member"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="font-display text-[20px] font-semibold leading-none tracking-[-0.03em] text-ink">{member.totalHours}h</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-zinc-400">Logged</p>
                      </div>
                      {member.averageRating !== null ? (
                        <div className="hidden border-l border-line pl-3 sm:block">
                          <p className="font-display text-[16px] font-semibold leading-none text-ink">{member.averageRating}/5</p>
                          <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-zinc-400">Avg rating</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-b border-line bg-zinc-50/40 px-4 py-2.5">
                    <DayStrip days={weekDays} member={member} today={today} />
                    {member.missingDays.length ? (
                      <p className="mt-2 text-[9.5px] text-red/80">
                        No entry: {member.missingDays.map((day) => formatIstDate(day)).join(", ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-[9.5px] text-zinc-400">All weekdays covered.</p>
                    )}
                  </div>

                  {member.logs.length ? (
                    <ul className="divide-y divide-zinc-100">
                      {member.logs.map((log) => {
                        const linked = log.taskIds.map((id) => taskMap.get(id)).filter((task): task is TaskRow => Boolean(task));
                        const canEdit = isMe && log.logDate === today;
                        const showRateControls = canRate && !isMe;
                        return (
                          <li key={log.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="w-[58px] shrink-0">
                                <p className="text-[10.5px] font-semibold text-ink">{formatIstDate(log.logDate)}</p>
                                <p className="mt-0.5 text-[9px] text-zinc-400">{relativeDays(log.logDate)}</p>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="whitespace-pre-wrap text-[11.5px] leading-5 text-zinc-700">{log.summary}</p>
                                {linked.length ? (
                                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9.5px] text-zinc-500">
                                    <ListChecks className="size-3 shrink-0" aria-hidden />
                                    {linked.slice(0, 3).map((task) => (
                                      <span key={task.id} className="rounded border border-line bg-zinc-50 px-1.5 py-0.5">
                                        {task.title}
                                      </span>
                                    ))}
                                    {linked.length > 3 ? <span>+{linked.length - 3}</span> : null}
                                  </p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {showRateControls ? (
                                    <span className={cn("flex items-center gap-1", ratingBusy === log.id && "opacity-50")}>
                                      <Stars value={log.rating} onChange={(value) => void rate(log.id, value)} />
                                      {log.rating === null ? <span className="text-[9px] text-zinc-400">Rate</span> : null}
                                    </span>
                                  ) : canRate && isMe && log.rating !== null ? (
                                    <Stars value={log.rating} readOnly />
                                  ) : null}
                                  {canEdit ? (
                                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setForm({ mode: "edit", log })}>
                                      <Pencil className="size-3" aria-hidden /> Edit
                                    </Button>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[9px] text-zinc-400">
                                      <LockKeyhole className="size-2.5" aria-hidden /> Locked
                                    </span>
                                  )}
                                  <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600">
                                    {log.hours}h
                                  </span>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-[11px] text-zinc-400">No work logs this week.</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {form ? (
        <LogForm
          today={today}
          tasks={myTasks}
          initial={form.mode === "edit" ? form.log : undefined}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            setNotice(message);
            void reload(true);
          }}
        />
      ) : null}
    </div>
  );
}
