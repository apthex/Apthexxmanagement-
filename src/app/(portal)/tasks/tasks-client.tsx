"use client";

import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  TimerReset,
} from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatDateTime, formatIstDate, relativeDays } from "@/lib/dates";
import type { Lookups, TaskDetail, TaskRow, TaskStatus } from "@/lib/portal-types";
import { usePortal } from "@/components/portal/context";
import {
  Avatar,
  Card,
  Detail,
  EmptyState,
  ErrorState,
  FormGrid,
  FullWidth,
  InlineAlert,
  PageHeader,
  PersonCell,
  SearchField,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/table";

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function todayIst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function TaskForm({
  initial,
  people,
  clients,
  onClose,
  onSaved,
}: {
  initial?: TaskRow;
  people: Lookups["people"];
  clients: Lookups["clients"];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [assigneeMemberId, setAssigneeMemberId] = React.useState(initial?.assigneeMemberId ?? people[0]?.id ?? "");
  const [clientId, setClientId] = React.useState(initial?.clientId ?? "");
  const [dueOn, setDueOn] = React.useState(initial?.dueOn ?? "");
  const [status, setStatus] = React.useState<TaskStatus>(initial?.status ?? "todo");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!assigneeMemberId && people[0]) setAssigneeMemberId(people[0].id);
  }, [assigneeMemberId, people]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    if (!assigneeMemberId) {
      setError("Choose an assignee.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: nullable(description),
        assigneeMemberId,
        clientId: clientId || null,
        dueOn: dueOn || null,
        status,
      };
      if (initial) {
        await apiFetch(`/api/tasks/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        onSaved("Task updated.");
      } else {
        await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
        onSaved("Task created.");
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
      title={initial ? "Edit task" : "New task"}
      description={initial ? "Owners can edit every field. Assignees can only move the task status." : "Create a task for an active member. Client and due date are optional."}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="task-form" variant="primary" loading={loading}>
            {initial ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        <FormGrid>
          <FullWidth>
            <Field label="Task title" htmlFor="task-title" error={fields.title} required>
              <Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to happen?" required />
            </Field>
          </FullWidth>
          <FullWidth>
            <Field label="Description" htmlFor="task-description" error={fields.description}>
              <Textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Context, acceptance criteria, links…" />
            </Field>
          </FullWidth>
          <Field label="Assignee" htmlFor="task-assignee" error={fields.assigneeMemberId} required>
            <Select id="task-assignee" value={assigneeMemberId} onChange={(event) => setAssigneeMemberId(event.target.value)}>
              <option value="">Choose a member</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Client" htmlFor="task-client" error={fields.clientId}>
            <Select id="task-client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Internal / no client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.company}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="task-due" error={fields.dueOn}>
            <Input id="task-due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </Field>
          <Field label="Status" htmlFor="task-status">
            <Select id="task-status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
        </FormGrid>
      </form>
    </Modal>
  );
}

function TaskDetailModal({
  taskId,
  canEdit,
  onClose,
  onEdit,
  onChanged,
}: {
  taskId: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (task: TaskDetail) => void;
  onChanged: () => void;
}) {
  const { data, loading, error, reload } = useApi<{ task: TaskDetail }>(`/api/tasks/${taskId}`);
  const [statusBusy, setStatusBusy] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [commentBusy, setCommentBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const task = data?.task ?? null;
  const today = todayIst();

  async function changeStatus(next: TaskStatus) {
    if (!task) return;
    setStatusBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      await reload(true);
      onChanged();
    } catch (submitError) {
      setActionError(errorMessage(submitError));
    } finally {
      setStatusBusy(false);
    }
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) return;
    setCommentBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comment.trim() }),
      });
      setComment("");
      await reload(true);
    } catch (submitError) {
      setActionError(errorMessage(submitError));
    } finally {
      setCommentBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={task?.title ?? "Task"}
      description={task ? `${task.clientName ?? "Internal"} · Assigned to ${task.assigneeName}` : "Loading task…"}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canEdit && task ? (
            <Button variant="primary" onClick={() => onEdit(task)}>
              <Pencil className="size-3.5" aria-hidden /> Edit task
            </Button>
          ) : null}
        </>
      }
    >
      {loading ? (
        <TableSkeleton rows={6} cols={2} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : task ? (
        <div className="space-y-5">
          {actionError ? <InlineAlert tone="error">{actionError}</InlineAlert> : null}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-zinc-50/70 px-3 py-2.5">
            <StatusBadge value={task.status} />
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-zinc-500">Move to</span>
              <Select
                value={task.status}
                disabled={statusBusy}
                onChange={(event) => void changeStatus(event.target.value as TaskStatus)}
                className="h-8 w-auto min-w-[130px] text-[11.5px]"
                aria-label="Task status"
              >
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </div>
            <span className={`ml-auto flex items-center gap-1.5 text-[10.5px] ${task.dueOn && task.dueOn < today && task.status !== "done" ? "font-medium text-red" : "text-zinc-500"}`}>
              <CalendarDays className="size-3" aria-hidden />
              {task.dueOn ? `${formatIstDate(task.dueOn)} · ${relativeDays(task.dueOn)}` : "No due date"}
            </span>
          </div>

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <Detail label="Assignee"><PersonCell name={task.assigneeName} size="xs" /></Detail>
            <Detail label="Client">{task.clientName ?? "Internal"}</Detail>
            <Detail label="Updated">{formatDateTime(task.updatedAt)}</Detail>
            <Detail label="Created">{formatDateTime(task.createdAt)}</Detail>
            <Detail label="Completed">{task.completedAt ? formatDateTime(task.completedAt) : null}</Detail>
          </dl>

          <div>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-zinc-500">Description</p>
            {task.description ? (
              <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-line bg-white p-3 text-[12px] leading-5 text-zinc-600">{task.description}</p>
            ) : (
              <p className="mt-1.5 text-[11.5px] text-zinc-400">No description.</p>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.07em] text-zinc-500">
              <MessageSquare className="size-3" aria-hidden /> Comments · {task.comments.length}
            </p>
            <div className="space-y-3">
              {task.comments.map((entry) => (
                <div key={entry.id} className="flex gap-2.5">
                  <Avatar name={entry.memberName} size="sm" />
                  <div className="min-w-0 flex-1 rounded-lg border border-line bg-zinc-50/60 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className="text-[11.5px] font-medium text-ink">{entry.memberName}</p>
                      <p className="text-[9.5px] text-zinc-400">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-5 text-zinc-600">{entry.body}</p>
                  </div>
                </div>
              ))}
              {!task.comments.length ? <p className="text-[11.5px] text-zinc-400">No comments yet.</p> : null}
            </div>
            <form onSubmit={addComment} className="mt-3">
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a note for the team…"
                className="min-h-[70px]"
                aria-label="New comment"
              />
              <div className="mt-2 flex justify-end">
                <Button type="submit" size="sm" variant="outline" loading={commentBusy} disabled={!comment.trim()}>
                  Add comment
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function TasksClient() {
  const { user, can } = usePortal();
  const isOwner = user.accessLevel === "owner";
  const canCreate = can("tasks.create");
  const { data, loading, error, reload } = useApi<{ tasks: TaskRow[]; count: number }>("/api/tasks");
  const lookups = useApi<Lookups>("/api/lookups");
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | TaskStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState("all");
  const [dueFilter, setDueFilter] = React.useState<"all" | "overdue" | "today" | "none">("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTask, setEditTask] = React.useState<TaskRow | null>(null);
  const [statusBusy, setStatusBusy] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const tasks = data?.tasks ?? [];
  const people = lookups.data?.people ?? [];
  const clients = lookups.data?.clients ?? [];
  const today = todayIst();

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && task.assigneeMemberId !== assigneeFilter) return false;
      if (dueFilter === "overdue" && !(task.status !== "done" && task.dueOn && task.dueOn < today)) return false;
      if (dueFilter === "today" && task.dueOn !== today) return false;
      if (dueFilter === "none" && task.dueOn !== null) return false;
      if (!term) return true;
      return [task.title, task.description, task.clientName, task.assigneeName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [assigneeFilter, dueFilter, query, statusFilter, tasks, today]);

  const counts = React.useMemo(
    () => ({
      open: tasks.filter((task) => task.status !== "done").length,
      overdue: tasks.filter((task) => task.status !== "done" && task.dueOn && task.dueOn < today).length,
      dueToday: tasks.filter((task) => task.status !== "done" && task.dueOn === today).length,
      done: tasks.filter((task) => task.status === "done").length,
    }),
    [tasks, today],
  );

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function updateStatus(task: TaskRow, status: TaskStatus) {
    setStatusBusy(task.id);
    setActionError(null);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`Task moved to ${STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status}.`);
      void reload(true);
      if (selectedId === task.id) {
        // The detail modal owns its own copy and will refresh on next open.
      }
    } catch (submitError) {
      setActionError(errorMessage(submitError));
    } finally {
      setStatusBusy(null);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Delivery" title="Tasks" description="Everything assigned to you, with the context needed to finish it." />
        <Card><TableSkeleton rows={7} cols={5} /></Card>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Delivery" title="Tasks" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="Tasks"
        description={isOwner ? "Every task across the team. Assignees can only move their own task status." : "Tasks assigned to you. Update the status as work progresses."}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> New task
            </Button>
          ) : null
        }
      />

      {notice ? <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert> : null}
      {actionError ? <InlineAlert tone="error" className="mb-4">{actionError}</InlineAlert> : null}

      <div className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open tasks", value: counts.open, icon: ListChecks, tone: "text-info dark:text-sky-400" },
          { label: "Overdue", value: counts.overdue, icon: TimerReset, tone: "text-red dark:text-red-400" },
          { label: "Due today", value: counts.dueToday, icon: CalendarDays, tone: "text-warn dark:text-amber-400" },
          { label: "Completed", value: counts.done, icon: CheckCircle2, tone: "text-ok dark:text-emerald-400" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="flex items-center justify-between p-4">
              <div>
                <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
                <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{isOwner ? "Across the team" : "Assigned to you"}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon className={`size-4.5 ${item.tone}`} aria-hidden />
                <p className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink dark:text-white">{item.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Search tasks, clients, assignees…" className="xl:max-w-xs" />
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter by status" className="w-auto min-w-[130px]">
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          {isOwner ? (
            <Select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} aria-label="Filter by assignee" className="w-auto min-w-[150px]">
              <option value="all">All assignees</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </Select>
          ) : null}
          <Select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as typeof dueFilter)} aria-label="Filter by due date" className="w-auto min-w-[135px]">
            <option value="all">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="none">No due date</option>
          </Select>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 xl:ml-auto">{filtered.length} of {tasks.length}</span>
        </div>
      </Card>

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Task</TH>
              <TH>Assignee</TH>
              <TH>Due</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
              <TH aria-label="Open" />
            </TR>
          </THead>
          <TBody>
            {filtered.map((task) => {
              const overdue = Boolean(task.dueOn && task.dueOn < today && task.status !== "done");
              return (
                <TR key={task.id} onClick={() => setSelectedId(task.id)}>
                  <TD>
                    <p className="max-w-[420px] truncate text-[13px] font-medium text-ink dark:text-zinc-100 group-hover:text-red transition-colors">{task.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{task.clientName ?? "Internal"} {task.description ? `· ${task.description}` : ""}</p>
                  </TD>
                  <TD><PersonCell name={task.assigneeName} size="xs" /></TD>
                  <TD>
                    <span className={`flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] ${overdue ? "font-bold text-red" : "text-zinc-500 dark:text-zinc-400"}`}>
                      <CalendarDays className="size-3" aria-hidden />
                      {task.dueOn ? relativeDays(task.dueOn) : "—"}
                    </span>
                  </TD>
                  <TD onClick={(event) => event.stopPropagation()}>
                    <Select
                      value={task.status}
                      disabled={statusBusy === task.id}
                      onChange={(event) => void updateStatus(task, event.target.value as TaskStatus)}
                      className="h-7 w-[126px] text-[10.5px]"
                      aria-label={`Status for ${task.title}`}
                    >
                      {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </TD>
                  <TD className="whitespace-nowrap text-[11px] text-zinc-500">{formatIstDate(task.updatedAt)}</TD>
                  <TD><ChevronRight className="size-3.5 text-zinc-300" aria-hidden /></TD>
                </TR>
              );
            })}
            {!filtered.length ? (
              <TR>
                <TD colSpan={6}>
                  <EmptyState
                    icon={ListChecks}
                    compact
                    title={tasks.length ? "No tasks match" : "No tasks yet"}
                    description={tasks.length ? "Try a different filter." : isOwner ? "Create a task for the team." : "Tasks assigned to you will appear here."}
                    action={canCreate ? <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New task</Button> : null}
                  />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </TableWrap>

      {selectedId ? (
        <TaskDetailModal
          taskId={selectedId}
          canEdit={isOwner}
          onClose={() => setSelectedId(null)}
          onEdit={(task) => {
            setSelectedId(null);
            setEditTask(task);
          }}
          onChanged={() => void reload(true)}
        />
      ) : null}

      {createOpen ? (
        <TaskForm
          people={people}
          clients={clients}
          onClose={() => setCreateOpen(false)}
          onSaved={(message) => {
            setCreateOpen(false);
            setNotice(message);
            void reload(true);
          }}
        />
      ) : null}

      {editTask ? (
        <TaskForm
          initial={editTask}
          people={people}
          clients={clients}
          onClose={() => setEditTask(null)}
          onSaved={(message) => {
            setEditTask(null);
            setNotice(message);
            void reload(true);
          }}
        />
      ) : null}
    </div>
  );
}
