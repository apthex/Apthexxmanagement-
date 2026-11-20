"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, IndianRupee, Plus } from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatIstDate } from "@/lib/dates";
import { humanize, shortName } from "@/lib/format";
import type {
  AgreementStatus,
  ClientInput,
  ClientRow,
  ClientStatus,
  Lookups,
  ServiceType,
} from "@/lib/portal-types";
import { usePortal } from "@/components/portal/context";
import {
  Avatar,
  Card,
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
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/table";

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function ClientForm({
  owners,
  onClose,
  onSaved,
}: {
  owners: Lookups["owners"];
  onClose: () => void;
  onSaved: (client: ClientRow) => void;
}) {
  const [company, setCompany] = React.useState("");
  const [ownerMemberId, setOwnerMemberId] = React.useState(owners[0]?.id ?? "");
  const [serviceType, setServiceType] = React.useState<ServiceType>("awareness");
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [scopeOfWork, setScopeOfWork] = React.useState("");
  const [agreementStatus, setAgreementStatus] = React.useState<AgreementStatus>("none");
  const [agreementRef, setAgreementRef] = React.useState("");
  const [agreementSignedOn, setAgreementSignedOn] = React.useState("");
  const [status, setStatus] = React.useState<ClientStatus>("active");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!ownerMemberId && owners[0]) setOwnerMemberId(owners[0].id);
  }, [ownerMemberId, owners]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    if (!ownerMemberId) {
      setError("Choose an active owner for this client.");
      return;
    }
    const payload: ClientInput = {
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
    };
    setLoading(true);
    try {
      const result = await apiFetch<{ client: ClientRow }>("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSaved(result.client);
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
      title="New client"
      description="Create a client record directly. A signed agreement is not required."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="client-form" variant="primary" loading={loading}>
            Create client
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {!owners.length ? <InlineAlert tone="warning">No active owner is available.</InlineAlert> : null}
        <FormGrid>
          <FullWidth>
            <Field label="Company" htmlFor="client-company" error={fields.company} required>
              <Input id="client-company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Client company" required />
            </Field>
          </FullWidth>
          <Field label="Client owner" htmlFor="client-owner" error={fields.ownerMemberId} required>
            <Select id="client-owner" value={ownerMemberId} onChange={(event) => setOwnerMemberId(event.target.value)}>
              <option value="">Choose an owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Service" htmlFor="client-service">
            <Select id="client-service" value={serviceType} onChange={(event) => setServiceType(event.target.value as ServiceType)}>
              <option value="awareness">Security awareness</option>
              <option value="vapt">VAPT</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Contact name" htmlFor="client-contact" error={fields.contactName}>
            <Input id="client-contact" value={contactName} onChange={(event) => setContactName(event.target.value)} />
          </Field>
          <Field label="Contact email" htmlFor="client-email" error={fields.contactEmail}>
            <Input id="client-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
          </Field>
          <Field label="Contact phone" htmlFor="client-phone" error={fields.contactPhone}>
            <Input id="client-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
          </Field>
          <Field label="Status" htmlFor="client-status">
            <Select id="client-status" value={status} onChange={(event) => setStatus(event.target.value as ClientStatus)}>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
          <FullWidth>
            <Field label="Scope of work" htmlFor="client-scope" error={fields.scopeOfWork}>
              <Textarea id="client-scope" value={scopeOfWork} onChange={(event) => setScopeOfWork(event.target.value)} placeholder="What was sold, deliverables, timeline…" />
            </Field>
          </FullWidth>
          <Field label="Agreement status" htmlFor="client-agreement">
            <Select id="client-agreement" value={agreementStatus} onChange={(event) => setAgreementStatus(event.target.value as AgreementStatus)}>
              <option value="none">No agreement</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="expired">Expired</option>
            </Select>
          </Field>
          <Field label="Agreement reference" htmlFor="client-ref" error={fields.agreementRef}>
            <Input id="client-ref" value={agreementRef} onChange={(event) => setAgreementRef(event.target.value)} placeholder="Contract / proposal ID" />
          </Field>
          <Field label="Agreement signed on" htmlFor="client-signed" error={fields.agreementSignedOn}>
            <Input id="client-signed" type="date" value={agreementSignedOn} onChange={(event) => setAgreementSignedOn(event.target.value)} />
          </Field>
          <FullWidth>
            <Field label="Notes" htmlFor="client-notes" error={fields.notes}>
              <Textarea id="client-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </FullWidth>
        </FormGrid>
      </form>
    </Modal>
  );
}

export function ClientsClient() {
  const router = useRouter();
  const { can } = usePortal();
  const canWrite = can("clients.write");
  const { data, loading, error, reload } = useApi<{ clients: ClientRow[]; count: number }>("/api/clients");
  const lookups = useApi<Lookups>(canWrite ? "/api/lookups" : null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ClientStatus>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const clients = data?.clients ?? [];
  const owners = lookups.data?.owners ?? [];

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter !== "all" && client.status !== statusFilter) return false;
      if (!term) return true;
      return [client.company, client.contactName, client.contactEmail, client.ownerName, ...client.assigned.map((member) => member.name)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [clients, query, statusFilter]);

  const counts = React.useMemo(
    () => ({
      active: clients.filter((client) => client.status === "active").length,
      onHold: clients.filter((client) => client.status === "on_hold").length,
      signed: clients.filter((client) => client.agreementStatus === "signed").length,
    }),
    [clients],
  );

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Accounts" title="Clients" description="Every active engagement, service and agreement in one table." />
        <Card><TableSkeleton rows={7} cols={6} /></Card>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Accounts" title="Clients" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Clients"
        description="Every engagement and agreement in one table. Team members only see clients they are assigned to."
        actions={
          canWrite ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> New client
            </Button>
          ) : null
        }
      />

      {notice ? <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Active clients", value: counts.active, note: "Currently engaged" },
          { label: "On hold", value: counts.onHold, note: "Paused but not closed" },
          { label: "Signed agreements", value: counts.signed, note: "Across all clients" },
        ].map((item) => (
          <Card key={item.label} className="flex items-center justify-between p-4">
            <div>
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">{item.label}</p>
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{item.note}</p>
            </div>
            <p className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink dark:text-white">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Search clients, contacts, assigned team…" className="sm:max-w-sm" />
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter by status" className="w-auto min-w-[140px]">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="closed">Closed</option>
          </Select>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 sm:ml-auto">{filtered.length} of {clients.length}</span>
        </div>
      </Card>

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>Service</TH>
              <TH>Status</TH>
              <TH>Agreement</TH>
              <TH>Owner</TH>
              <TH>Assigned</TH>
              <TH>Updated</TH>
              <TH aria-label="Open" />
            </TR>
          </THead>
          <TBody>
            {filtered.map((client) => (
              <TR key={client.id} onClick={() => router.push(`/clients/${client.id}`)}>
                <TD>
                  <p className="text-[13px] font-semibold text-ink dark:text-zinc-100 group-hover:text-red transition-colors">{client.company}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{client.contactName || client.contactEmail || "No contact"}</p>
                </TD>
                <TD className="text-[12px] text-zinc-700 dark:text-zinc-300">{humanize(client.serviceType)}</TD>
                <TD><StatusBadge value={client.status} /></TD>
                <TD><StatusBadge value={client.agreementStatus} /></TD>
                <TD><span className="flex items-center gap-1.5 text-[12px] text-zinc-700 dark:text-zinc-300"><Avatar name={client.ownerName} size="xs" />{shortName(client.ownerName)}</span></TD>
                <TD>
                  {client.assigned.length ? (
                    <span className="flex items-center -space-x-1.5">
                      {client.assigned.slice(0, 4).map((member) => <Avatar key={member.id} name={member.name} size="xs" />)}
                      {client.assigned.length > 4 ? (
                        <span className="flex size-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#1E1E28] text-[9px] font-medium text-zinc-600 dark:text-zinc-300 ring-2 ring-white dark:ring-[#16161D]">
                          +{client.assigned.length - 4}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">Unassigned</span>
                  )}
                </TD>
                <TD className="whitespace-nowrap font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{formatIstDate(client.updatedAt)}</TD>
                <TD><ChevronRight className="size-3.5 text-zinc-300 dark:text-zinc-600" aria-hidden /></TD>
              </TR>
            ))}
            {!filtered.length ? (
              <TR>
                <TD colSpan={8}>
                  <EmptyState
                    icon={Building2}
                    compact
                    title={clients.length ? "No clients match" : "No clients yet"}
                    description={clients.length ? "Try a different search or status." : canWrite ? "Create the first client record." : "Clients will appear here when the team adds them."}
                  />
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </TableWrap>

      {filtered.some((client) => client.agreementStatus !== "signed" && client.status === "active") ? (
        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-zinc-400">
          <IndianRupee className="size-3" aria-hidden /> An unsigned agreement never blocks delivery. Agreement state is tracked separately.
        </p>
      ) : null}

      {createOpen ? (
        <ClientForm
          owners={owners}
          onClose={() => setCreateOpen(false)}
          onSaved={(client) => {
            setCreateOpen(false);
            setNotice("Client created.");
            void reload(true);
            router.push(`/clients/${client.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
