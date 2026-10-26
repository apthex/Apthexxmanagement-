"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  Mail,
  Pencil,
  Phone,
  Plus,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatDateTime, formatIstDate } from "@/lib/dates";
import { humanize } from "@/lib/format";
import type {
  AgreementStatus,
  ClientAssignment,
  ClientDetail,
  ClientStatus,
  Lookups,
  ServiceType,
} from "@/lib/portal-types";
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
  SectionHeader,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function EditClientModal({
  client,
  owners,
  onClose,
  onSaved,
}: {
  client: ClientDetail;
  owners: Lookups["owners"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [company, setCompany] = React.useState(client.company);
  const [ownerMemberId, setOwnerMemberId] = React.useState(client.ownerMemberId);
  const [serviceType, setServiceType] = React.useState<ServiceType>(client.serviceType);
  const [contactName, setContactName] = React.useState(client.contactName ?? "");
  const [contactEmail, setContactEmail] = React.useState(client.contactEmail ?? "");
  const [contactPhone, setContactPhone] = React.useState(client.contactPhone ?? "");
  const [scopeOfWork, setScopeOfWork] = React.useState(client.scopeOfWork ?? "");
  const [agreementStatus, setAgreementStatus] = React.useState<AgreementStatus>(client.agreementStatus);
  const [agreementRef, setAgreementRef] = React.useState(client.agreementRef ?? "");
  const [agreementSignedOn, setAgreementSignedOn] = React.useState(client.agreementSignedOn ?? "");
  const [status, setStatus] = React.useState<ClientStatus>(client.status);
  const [notes, setNotes] = React.useState(client.notes ?? "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      await apiFetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          company: company.trim(),
          ownerMemberId,
          serviceType,
          contactName: nullable(contactName),
          contactEmail: nullable(contactEmail),
          contactPhone: nullable(contactPhone),
          scopeOfWork: nullable(scopeOfWork),
          agreementStatus,
          agreementRef: nullable(agreementRef),
          agreementSignedOn: agreementSignedOn || null,
          status,
          notes: nullable(notes),
        }),
      });
      onSaved();
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
      title="Edit client"
      description="Updates are attributed to you in the audit trail."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-client-form" variant="primary" loading={loading}>Save changes</Button>
        </>
      }
    >
      <form id="edit-client-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        <FormGrid>
          <FullWidth>
            <Field label="Company" htmlFor="edit-company" error={fields.company} required>
              <Input id="edit-company" value={company} onChange={(event) => setCompany(event.target.value)} required />
            </Field>
          </FullWidth>
          <Field label="Client owner" htmlFor="edit-owner" error={fields.ownerMemberId} required>
            <Select id="edit-owner" value={ownerMemberId} onChange={(event) => setOwnerMemberId(event.target.value)}>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </Select>
          </Field>
          <Field label="Service" htmlFor="edit-service">
            <Select id="edit-service" value={serviceType} onChange={(event) => setServiceType(event.target.value as ServiceType)}>
              <option value="awareness">Security awareness</option>
              <option value="vapt">VAPT</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Contact name" htmlFor="edit-contact" error={fields.contactName}>
            <Input id="edit-contact" value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </Field>
          <Field label="Contact email" htmlFor="edit-email" error={fields.contactEmail}>
            <Input id="edit-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
          </Field>
          <Field label="Contact phone" htmlFor="edit-phone" error={fields.contactPhone}>
            <Input id="edit-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
          </Field>
          <Field label="Status" htmlFor="edit-status">
            <Select id="edit-status" value={status} onChange={(event) => setStatus(event.target.value as ClientStatus)}>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
          <FullWidth>
            <Field label="Scope of work" htmlFor="edit-scope" error={fields.scopeOfWork}>
              <Textarea id="edit-scope" value={scopeOfWork} onChange={(event) => setScopeOfWork(event.target.value)} />
            </Field>
          </FullWidth>
          <Field label="Agreement status" htmlFor="edit-agreement">
            <Select id="edit-agreement" value={agreementStatus} onChange={(event) => setAgreementStatus(event.target.value as AgreementStatus)}>
              <option value="none">No agreement</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="expired">Expired</option>
            </Select>
          </Field>
          <Field label="Agreement reference" htmlFor="edit-ref" error={fields.agreementRef}>
            <Input id="edit-ref" value={agreementRef} onChange={(event) => setAgreementRef(event.target.value)} />
          </Field>
          <Field label="Agreement signed on" htmlFor="edit-signed" error={fields.agreementSignedOn}>
            <Input id="edit-signed" type="date" value={agreementSignedOn} onChange={(event) => setAgreementSignedOn(event.target.value)} />
          </Field>
          <FullWidth>
            <Field label="Notes" htmlFor="edit-notes" error={fields.notes}>
              <Textarea id="edit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </FullWidth>
        </FormGrid>
      </form>
    </Modal>
  );
}

function AssignModal({
  clientId,
  candidates,
  onClose,
  onSaved,
}: {
  clientId: string;
  candidates: Lookups["assignable"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [memberId, setMemberId] = React.useState(candidates[0]?.id ?? "");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId) {
      setError("Choose a team member.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/clients/${clientId}/assignments`, {
        method: "POST",
        body: JSON.stringify({ memberId, note: nullable(note) }),
      });
      onSaved();
    } catch (submitError) {
      setError(errorMessage(submitError));
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title="Assign team member"
      description="Assignments give team members access to this client, its meetings and related work."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assign-form" variant="primary" loading={loading} disabled={!memberId}>Assign</Button>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit} className="space-y-4">
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {!candidates.length ? (
          <InlineAlert tone="info">Every eligible team member is already assigned, or there are no active team/growth members.</InlineAlert>
        ) : null}
        <Field label="Team member" htmlFor="assign-member" required>
          <Select id="assign-member" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">Choose a member</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {humanize(candidate.accessLevel)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignment note" htmlFor="assign-note" hint="Optional. Visible to owners in the audit record.">
          <Input id="assign-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this client?" />
        </Field>
        <p className="text-[10.5px] leading-4 text-zinc-500">Owners already have access to every client. Viewers do not use assignments.</p>
      </form>
    </Modal>
  );
}

export function ClientDetailClient({ clientId }: { clientId: string }) {
  const { can } = usePortal();
  const canWrite = can("clients.write");
  const canAssign = can("clients.assign");
  const canReadPeople = can("members.read");
  const { data, loading, error, reload } = useApi<{ client: ClientDetail }>(`/api/clients/${clientId}`);
  const lookups = useApi<Lookups>(canReadPeople ? "/api/lookups" : null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [unassign, setUnassign] = React.useState<ClientAssignment | null>(null);
  const [unassigning, setUnassigning] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const client = data?.client ?? null;
  const owners = lookups.data?.owners ?? [];
  const peopleNames = React.useMemo(
    () => new Map((lookups.data?.people ?? []).map((person) => [person.id, person.name])),
    [lookups.data],
  );

  const assignCandidates = React.useMemo(() => {
    if (!client) return [];
    const assigned = new Set(client.assignments.map((assignment) => assignment.memberId));
    return (lookups.data?.assignable ?? []).filter((person) => !assigned.has(person.id));
  }, [client, lookups.data]);

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function confirmUnassign() {
    if (!unassign) return;
    setUnassigning(true);
    setActionError(null);
    try {
      await apiFetch(`/api/clients/${clientId}/assignments/${unassign.id}`, { method: "DELETE" });
      setUnassign(null);
      setNotice("Assignment removed.");
      void reload(true);
    } catch (submitError) {
      setActionError(errorMessage(submitError));
    } finally {
      setUnassigning(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="mb-5 space-y-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-8 w-64 rounded" />
        </div>
        <Card><TableSkeleton rows={6} cols={3} /></Card>
      </div>
    );
  }

  if (error || !client) {
    return (
      <>
        <PageHeader eyebrow="Clients" title="Client" />
        <ErrorState message={error ?? "This client could not be loaded."} onRetry={() => void reload()} />
        <Link href="/clients" className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500 hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden /> Back to clients
        </Link>
      </>
    );
  }

  return (
    <div>
      <Link href="/clients" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 transition hover:text-ink">
        <ArrowLeft className="size-3" aria-hidden /> Clients
      </Link>

      <PageHeader
        eyebrow="Client account"
        title={client.company}
        description={`${humanize(client.serviceType)}${client.contactName ? ` · ${client.contactName}` : ""} · Added ${formatIstDate(client.createdAt)}`}
        actions={
          <>
            {canWrite ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" aria-hidden /> Edit client
              </Button>
            ) : null}
            {canAssign ? (
              <Button variant="primary" onClick={() => setAssignOpen(true)}>
                <UserPlus className="size-3.5" aria-hidden /> Assign
              </Button>
            ) : null}
          </>
        }
      />

      {notice ? <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert> : null}
      {actionError ? <InlineAlert tone="error" className="mb-4">{actionError}</InlineAlert> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="team">Team · {client.assignments.length}</TabsTrigger>
              <TabsTrigger value="meetings">Meetings · {client.meetings.length}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <SectionHeader title="Contact" />
                    <div className="space-y-3 px-5 py-4 text-[12px]">
                      {client.contactName ? <p className="font-medium text-ink">{client.contactName}</p> : <p className="text-zinc-400">No contact name</p>}
                      {client.contactEmail ? (
                        <a href={`mailto:${client.contactEmail}`} className="flex items-center gap-2 break-all text-info hover:underline">
                          <Mail className="size-3.5 shrink-0" aria-hidden /> {client.contactEmail}
                        </a>
                      ) : null}
                      {client.contactPhone ? (
                        <a href={`tel:${client.contactPhone}`} className="flex items-center gap-2 text-zinc-600 hover:text-ink">
                          <Phone className="size-3.5 shrink-0" aria-hidden /> {client.contactPhone}
                        </a>
                      ) : null}
                      {!client.contactName && !client.contactEmail && !client.contactPhone ? (
                        <p className="text-[11.5px] text-zinc-500">No contact details recorded.</p>
                      ) : null}
                    </div>
                  </Card>

                  <Card>
                    <SectionHeader title="Engagement" />
                    <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                      <Detail label="Service">{humanize(client.serviceType)}</Detail>
                      <Detail label="Status"><StatusBadge value={client.status} /></Detail>
                      <Detail label="Owner">
                        {client.ownerName ? <PersonCell name={client.ownerName} size="xs" /> : null}
                      </Detail>
                      <Detail label="Client since">{formatIstDate(client.createdAt)}</Detail>
                    </dl>
                  </Card>
                </div>

                <Card>
                  <SectionHeader title="Agreement" description="Agreement status is tracked separately and never blocks delivery." />
                  <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                    <Detail label="State"><StatusBadge value={client.agreementStatus} /></Detail>
                    <Detail label="Reference">{client.agreementRef}</Detail>
                    <Detail label="Signed on">{client.agreementSignedOn ? formatIstDate(client.agreementSignedOn) : null}</Detail>
                  </dl>
                </Card>

                <Card>
                  <SectionHeader title="Scope of work" />
                  <div className="px-5 py-4">
                    {client.scopeOfWork ? (
                      <p className="whitespace-pre-wrap text-[12px] leading-5 text-zinc-600">{client.scopeOfWork}</p>
                    ) : (
                      <p className="text-[11.5px] text-zinc-400">No scope recorded yet.</p>
                    )}
                  </div>
                </Card>

                <Card>
                  <SectionHeader title="Internal notes" />
                  <div className="px-5 py-4">
                    {client.notes ? (
                      <p className="whitespace-pre-wrap text-[12px] leading-5 text-zinc-600">{client.notes}</p>
                    ) : (
                      <p className="text-[11.5px] text-zinc-400">No notes recorded.</p>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="team">
              <Card>
                <SectionHeader
                  title="Assigned team"
                  description="Only owners can change assignments. Assigned members can see this client and its meetings."
                  action={
                    canAssign ? (
                      <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                        <Plus className="size-3.5" aria-hidden /> Assign member
                      </Button>
                    ) : null
                  }
                />
                {client.assignments.length ? (
                  <ul className="divide-y divide-zinc-100">
                    {client.assignments.map((assignment) => (
                      <li key={assignment.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <Avatar name={assignment.name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-ink">{assignment.name}</p>
                          <p className="text-[10.5px] text-zinc-500">
                            {assignment.roleTitle || humanize(assignment.accessLevel)} · assigned {formatIstDate(assignment.assignedAt)}
                            {assignment.assignedByName ? ` by ${assignment.assignedByName}` : ""}
                          </p>
                        </div>
                        <StatusBadge value={assignment.accessLevel} />
                        {canAssign ? (
                          <Button variant="ghost" size="sm" onClick={() => setUnassign(assignment)}>
                            <UserMinus className="size-3.5" aria-hidden /> Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Users}
                    compact
                    title="No one assigned yet"
                    description={canAssign ? "Assign a team member so they can access this client." : "An owner has not assigned anyone to this client."}
                    action={canAssign ? <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}><UserPlus className="size-3.5" /> Assign member</Button> : null}
                  />
                )}
              </Card>
            </TabsContent>

            <TabsContent value="meetings">
              <Card>
                <SectionHeader
                  title="Client meetings"
                  description="Meetings linked to this account, newest first."
                  action={
                    <Link href="/meetings" className="text-[11px] font-medium text-zinc-500 hover:text-ink">
                      All meetings →
                    </Link>
                  }
                />
                {client.meetings.length ? (
                  <ul className="divide-y divide-zinc-100">
                    {client.meetings.map((meeting) => (
                      <li key={meeting.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[12.5px] font-medium text-ink">{meeting.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-zinc-500">
                              <span className="flex items-center gap-1"><CalendarDays className="size-3" aria-hidden />{formatIstDate(meeting.heldOn)}</span>
                              <span aria-hidden>·</span>
                              <span>{meeting.attendeeMemberIds.length + (meeting.externalAttendees ? meeting.externalAttendees.split(",").filter(Boolean).length : 0)} attendees</span>
                            </p>
                          </div>
                          <div className="flex -space-x-1.5">
                            {meeting.attendeeMemberIds.slice(0, 3).map((memberId) => (
                              <Avatar key={memberId} name={peopleNames.get(memberId) ?? "Apthex member"} size="xs" />
                            ))}
                          </div>
                        </div>
                        {meeting.notes ? <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-5 text-zinc-600">{meeting.notes}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={CalendarDays} compact title="No meetings recorded" description="Meetings linked to this client will appear here." />
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Card>
            <SectionHeader title="Account summary" />
            <dl className="space-y-4 px-5 py-4">
              <Detail label="Status"><StatusBadge value={client.status} /></Detail>
              <Detail label="Agreement"><StatusBadge value={client.agreementStatus} /></Detail>
              <Detail label="Owner">{client.ownerName ? <PersonCell name={client.ownerName} size="xs" /> : null}</Detail>
              <Detail label="Assigned team">{client.assignments.length ? `${client.assignments.length} member${client.assignments.length === 1 ? "" : "s"}` : "None"}</Detail>
              <Detail label="Meetings">{client.meetings.length}</Detail>
              <Detail label="Last updated">{formatDateTime(client.updatedAt)}</Detail>
            </dl>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[11px] font-medium text-ink">
              <ClipboardList className="size-3.5 text-zinc-400" aria-hidden /> Access rule
            </p>
            <p className="mt-1.5 text-[10.5px] leading-4 text-zinc-500">
              Owners see every client. Team members see only clients assigned to them. Viewers see the client directory without delivery access.
            </p>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[11px] font-medium text-ink">
              <FileText className="size-3.5 text-zinc-400" aria-hidden /> Agreement is not a gate
            </p>
            <p className="mt-1.5 text-[10.5px] leading-4 text-zinc-500">
              A client can be active without a signed agreement. The two states are deliberately independent.
            </p>
          </Card>
        </aside>
      </div>

      {editOpen ? (
        <EditClientModal
          client={client}
          owners={owners}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            setNotice("Client updated.");
            void reload(true);
          }}
        />
      ) : null}

      {assignOpen ? (
        <AssignModal
          clientId={clientId}
          candidates={assignCandidates}
          onClose={() => setAssignOpen(false)}
          onSaved={() => {
            setAssignOpen(false);
            setNotice("Team member assigned.");
            void reload(true);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(unassign)}
        onOpenChange={(open) => !open && setUnassign(null)}
        title="Remove assignment"
        description={
          <>
            Remove <strong>{unassign?.name}</strong> from this client? Their access will be revoked immediately. Existing
            work and audit records are unchanged.
          </>
        }
        confirmWord={unassign?.name ?? ""}
        confirmLabel="Remove assignment"
        onConfirm={() => void confirmUnassign()}
        loading={unassigning}
      />
    </div>
  );
}
