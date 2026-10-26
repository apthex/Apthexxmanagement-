"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CalendarRange,
  ExternalLink,
  Pencil,
  Plus,
  UserRound,
  Users,
} from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatIstDate, formatIstDateTime } from "@/lib/dates";
import { todayIst } from "@/lib/format";
import type { Lookups, MeetingRow } from "@/lib/portal-types";
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
  SearchField,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function monthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

function MeetingForm({
  initial,
  people,
  clients,
  currentMemberId,
  onClose,
  onSaved,
}: {
  initial?: MeetingRow;
  people: Lookups["people"];
  clients: Lookups["clients"];
  currentMemberId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [heldOn, setHeldOn] = React.useState(initial?.heldOn ?? todayIst());
  const [clientId, setClientId] = React.useState(initial?.clientId ?? "");
  const [attendeeIds, setAttendeeIds] = React.useState<string[]>(initial?.attendeeMemberIds ?? [currentMemberId]);
  const [externalAttendees, setExternalAttendees] = React.useState(initial?.externalAttendees ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  function toggleAttendee(memberId: string) {
    setAttendeeIds((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        heldOn,
        clientId: clientId || null,
        attendeeMemberIds: attendeeIds,
        externalAttendees: nullable(externalAttendees),
        notes: nullable(notes),
      };
      if (initial) {
        await apiFetch(`/api/meetings/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        onSaved("Meeting updated.");
      } else {
        await apiFetch("/api/meetings", { method: "POST", body: JSON.stringify(payload) });
        onSaved("Meeting recorded.");
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
      title={initial ? "Edit meeting" : "Record a meeting"}
      description="Meetings are a shared record. External attendees are free text; no contact records are created."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="meeting-form" variant="primary" loading={loading}>
            {initial ? "Save changes" : "Record meeting"}
          </Button>
        </>
      }
    >
      <form id="meeting-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        <FormGrid>
          <FullWidth>
            <Field label="Meeting title" htmlFor="meeting-title" error={fields.title} required>
              <Input
                id="meeting-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Kick-off, weekly review, scoping call…"
                required
              />
            </Field>
          </FullWidth>
          <Field label="Date held" htmlFor="meeting-date" error={fields.heldOn} required>
            <Input id="meeting-date" type="date" value={heldOn} onChange={(event) => setHeldOn(event.target.value)} required />
          </Field>
          <Field label="Client" htmlFor="meeting-client" error={fields.clientId}>
            <Select id="meeting-client" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">No client / internal</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.company}</option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-zinc-700">Apthex attendees</p>
          <p className="mb-2 text-[10.5px] text-zinc-500">Team members see meetings they attended or that belong to an assigned client.</p>
          <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2 apt-scroll">
            {people.map((person) => (
              <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-[11.5px] hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={attendeeIds.includes(person.id)}
                  onChange={() => toggleAttendee(person.id)}
                  className="size-3.5 rounded border-line accent-red"
                />
                <span className="min-w-0 flex-1 truncate text-zinc-600">{person.name}</span>
                <span className="text-[9px] text-zinc-400">{person.accessLevel}</span>
              </label>
            ))}
          </div>
        </div>

        <Field
          label="External attendees"
          htmlFor="meeting-external"
          error={fields.externalAttendees}
          hint="Comma-separated names and organisations. Not stored as contacts."
        >
          <Input
            id="meeting-external"
            value={externalAttendees}
            onChange={(event) => setExternalAttendees(event.target.value)}
            placeholder="Priya Sharma (Acme), Rahul (Prospect Co.)"
          />
        </Field>

        <Field label="Notes" htmlFor="meeting-notes" error={fields.notes} hint="Decisions, next steps, risks, owners.">
          <Textarea
            id="meeting-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-[130px]"
            placeholder="What was discussed, decided and assigned?"
          />
        </Field>
      </form>
    </Modal>
  );
}

function MeetingDetailModal({
  meeting,
  canEdit,
  onClose,
  onEdit,
}: {
  meeting: MeetingRow;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const external = meeting.externalAttendees
    ? meeting.externalAttendees.split(",").map((name) => name.trim()).filter(Boolean)
    : [];
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={meeting.title}
      description={`${formatIstDate(meeting.heldOn)}${meeting.clientName ? ` · ${meeting.clientName}` : " · Internal"}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canEdit ? (
            <Button variant="primary" onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden /> Edit meeting
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Date">{formatIstDate(meeting.heldOn)}</Detail>
          <Detail label="Client">
            {meeting.clientName ? (
              meeting.clientId ? (
                <Link href={`/clients/${meeting.clientId}`} className="inline-flex items-center gap-1 text-info hover:underline">
                  {meeting.clientName} <ExternalLink className="size-3" aria-hidden />
                </Link>
              ) : (
                meeting.clientName
              )
            ) : "Internal"}
          </Detail>
          <Detail label="Apthex attendees">
            {meeting.attendees.length ? (
              <span className="flex flex-wrap gap-1.5">
                {meeting.attendees.map((attendee) => (
                  <span key={attendee.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-zinc-50 py-0.5 pl-0.5 pr-2 text-[10.5px]">
                    <Avatar name={attendee.name} size="xs" /> {attendee.name}
                  </span>
                ))}
              </span>
            ) : null}
          </Detail>
          <Detail label="External attendees">{external.join(", ")}</Detail>
          <Detail label="Recorded">{formatIstDateTime(meeting.createdAt)}</Detail>
          <Detail label="Updated">{formatIstDateTime(meeting.updatedAt)}</Detail>
        </dl>

        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-zinc-500">Notes</p>
          {meeting.notes ? (
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-line bg-zinc-50/60 p-3 text-[12px] leading-5 text-zinc-600">
              {meeting.notes}
            </p>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-zinc-400">No notes recorded for this meeting.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function MeetingsClient() {
  const { user, can } = usePortal();
  const canWrite = can("meetings.write");
  const { data, loading, error, reload } = useApi<{ meetings: MeetingRow[]; count: number }>("/api/meetings");
  const lookups = useApi<Lookups>(canWrite ? "/api/lookups" : null);
  const [query, setQuery] = React.useState("");
  const [clientFilter, setClientFilter] = React.useState("all");
  const [monthFilter, setMonthFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<MeetingRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MeetingRow | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const meetings = data?.meetings ?? [];
  const people = lookups.data?.people ?? [];
  const clients = lookups.data?.clients ?? [];
  const currentMonth = todayIst().slice(0, 7);

  const clientOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    meetings.forEach((meeting) => {
      if (meeting.clientId && meeting.clientName) map.set(meeting.clientId, meeting.clientName);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [meetings]);

  const monthOptions = React.useMemo(() => {
    const set = new Set(meetings.map((meeting) => meeting.heldOn.slice(0, 7)));
    return [...set].sort().reverse();
  }, [meetings]);

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return meetings.filter((meeting) => {
      if (clientFilter === "internal" && meeting.clientId !== null) return false;
      if (clientFilter !== "all" && clientFilter !== "internal" && meeting.clientId !== clientFilter) return false;
      if (monthFilter !== "all" && meeting.heldOn.slice(0, 7) !== monthFilter) return false;
      if (!term) return true;
      return [
        meeting.title,
        meeting.notes,
        meeting.clientName,
        meeting.externalAttendees,
        ...meeting.attendees.map((attendee) => attendee.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [clientFilter, meetings, monthFilter, query]);

  const groups = React.useMemo(() => {
    const map = new Map<string, MeetingRow[]>();
    filtered.forEach((meeting) => {
      const key = meeting.heldOn.slice(0, 7);
      const bucket = map.get(key) ?? [];
      bucket.push(meeting);
      map.set(key, bucket);
    });
    return [...map.entries()];
  }, [filtered]);

  const stats = React.useMemo(
    () => ({
      total: meetings.length,
      thisMonth: meetings.filter((meeting) => meeting.heldOn.slice(0, 7) === currentMonth).length,
      clientMeetings: meetings.filter((meeting) => Boolean(meeting.clientId)).length,
    }),
    [currentMonth, meetings],
  );

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openEdit(meeting: MeetingRow) {
    setSelected(null);
    setEditing(meeting);
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Team" title="Meetings" description="A durable record of client and internal meetings." />
        <Card><TableSkeleton rows={6} cols={3} /></Card>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Team" title="Meetings" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Meetings"
        description="A durable record of client and internal meetings, attendees and decisions."
        actions={
          canWrite ? (
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> Record meeting
            </Button>
          ) : null
        }
      />

      {notice ? <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert> : null}

      <div className="mb-4 grid gap-3.5 sm:grid-cols-3">
        {[
          { label: "Meetings recorded", value: stats.total, icon: CalendarDays },
          { label: "This month", value: stats.thisMonth, icon: CalendarRange },
          { label: "Client meetings", value: stats.clientMeetings, icon: Building2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="flex items-center justify-between p-4">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 text-zinc-400 dark:text-zinc-500" aria-hidden />
                <p className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink dark:text-white">{item.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Search meetings, clients, attendees…" className="lg:max-w-sm" />
          <Select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} aria-label="Filter by client" className="w-auto min-w-[160px]">
            <option value="all">All clients</option>
            <option value="internal">Internal only</option>
            {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
          <Select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} aria-label="Filter by month" className="w-auto min-w-[155px]">
            <option value="all">All months</option>
            {monthOptions.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
          </Select>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 lg:ml-auto">{filtered.length} of {meetings.length}</span>
        </div>
      </Card>

      {groups.length ? (
        <div className="space-y-5">
          {groups.map(([month, entries]) => (
            <section key={month}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-[14px] font-semibold tracking-[-0.01em] text-ink dark:text-white">{monthLabel(month)}</h2>
                <span className="rounded-full bg-zinc-100 dark:bg-white/[0.08] px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-500 dark:text-zinc-300">{entries.length}</span>
                <span className="h-px flex-1 bg-line dark:bg-white/[0.08]" />
              </div>
              <Card className="overflow-hidden">
                <ol className="relative ml-4 border-l border-line dark:border-white/[0.08] sm:ml-5">
                  {entries.map((meeting) => (
                    <li key={meeting.id} className="relative">
                      <span className="absolute -left-[4.5px] top-[22px] size-2 rounded-full border-2 border-white dark:border-[#131318] bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(meeting)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelected(meeting);
                          }
                        }}
                        className="cursor-pointer px-4 py-3.5 transition hover:bg-zinc-50/70 dark:hover:bg-white/[0.02] focus-visible:bg-zinc-50 dark:focus-visible:bg-white/[0.02] sm:px-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13px] font-semibold text-ink dark:text-zinc-100">{meeting.title}</p>
                              {meeting.clientId && meeting.clientName ? (
                                <Link
                                  href={`/clients/${meeting.clientId}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-medium text-info dark:text-sky-400 hover:underline"
                                >
                                  {meeting.clientName} <ExternalLink className="size-2.5" aria-hidden />
                                </Link>
                              ) : (
                                <span className="rounded bg-zinc-100 dark:bg-white/[0.08] px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-600 dark:text-zinc-300">Internal</span>
                              )}
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-500">
                              <span className="flex items-center gap-1"><CalendarDays className="size-3" aria-hidden />{formatIstDate(meeting.heldOn)}</span>
                              <span aria-hidden>·</span>
                              <span className="flex items-center gap-1"><UserRound className="size-3" aria-hidden />{meeting.attendees.length} Apthex{meeting.externalAttendees ? " + external" : ""}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                              {meeting.attendees.slice(0, 4).map((attendee) => (
                                <Avatar key={attendee.id} name={attendee.name} size="xs" />
                              ))}
                              {meeting.attendees.length > 4 ? (
                                <span className="flex size-6 items-center justify-center rounded-full bg-zinc-100 text-[8.5px] font-medium text-zinc-600 ring-2 ring-white">
                                  +{meeting.attendees.length - 4}
                                </span>
                              ) : null}
                            </div>
                            {canWrite ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEdit(meeting);
                                }}
                                aria-label={`Edit ${meeting.title}`}
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {meeting.notes ? (
                          <p className="mt-2 line-clamp-2 text-[11px] leading-[17px] text-zinc-500">{meeting.notes}</p>
                        ) : null}
                        {meeting.externalAttendees ? (
                          <p className="mt-1.5 truncate text-[9.5px] text-zinc-400">External: {meeting.externalAttendees}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Users}
            title={meetings.length ? "No meetings match" : "No meetings recorded"}
            description={
              meetings.length
                ? "Try a different search, client or month."
                : canWrite
                  ? "Record the first meeting to start the shared log."
                  : "Meetings you attended will appear here."
            }
            action={canWrite ? <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}><Plus className="size-3.5" /> Record meeting</Button> : null}
          />
        </Card>
      )}

      {selected ? (
        <MeetingDetailModal
          meeting={selected}
          canEdit={canWrite}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
      ) : null}

      {formOpen ? (
        <MeetingForm
          people={people}
          clients={clients}
          currentMemberId={user.id}
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            setFormOpen(false);
            setNotice(message);
            void reload(true);
          }}
        />
      ) : null}

      {editing ? (
        <MeetingForm
          initial={editing}
          people={people}
          clients={clients}
          currentMemberId={user.id}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            void reload(true);
          }}
        />
      ) : null}
    </div>
  );
}
