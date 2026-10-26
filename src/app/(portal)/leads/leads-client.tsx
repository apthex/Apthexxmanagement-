"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  GripVertical,
  IndianRupee,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatInr, formatInrCompact, paiseToRupeeInput, rupeesToPaise, shortName } from "@/lib/format";
import { formatDateTime, formatIstDate, relativeDays } from "@/lib/dates";
import type {
  LeadDetail,
  LeadInput,
  LeadRow,
  LeadStage,
  Lookups,
  AgreementStatus,
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
  SearchField,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/table";

const STAGES: Array<{ key: LeadStage; label: string; dot: string }> = [
  { key: "identified", label: "Identified", dot: "bg-zinc-400" },
  { key: "talking", label: "Talking", dot: "bg-info" },
  { key: "pitched", label: "Pitched", dot: "bg-ink" },
  { key: "won", label: "Won", dot: "bg-ok" },
  { key: "lost", label: "Lost", dot: "bg-red" },
];

function stageLabel(stage: LeadStage) {
  return STAGES.find((entry) => entry.key === stage)?.label ?? stage;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function LeadForm({
  mode,
  initial,
  owners,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: LeadRow;
  owners: Lookups["owners"];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [company, setCompany] = React.useState(initial?.company ?? "");
  const [contactName, setContactName] = React.useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = React.useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = React.useState(initial?.contactPhone ?? "");
  const [source, setSource] = React.useState(initial?.source ?? "");
  const [ownerMemberId, setOwnerMemberId] = React.useState(initial?.ownerMemberId ?? owners[0]?.id ?? "");
  const [value, setValue] = React.useState(initial?.valueEstimatePaise != null ? paiseToRupeeInput(initial.valueEstimatePaise) : "");
  const [nextAction, setNextAction] = React.useState(initial?.nextAction ?? "");
  const [nextActionOn, setNextActionOn] = React.useState(initial?.nextActionOn ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
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
    if (!company.trim()) {
      setFields({ company: "Company is required." });
      return;
    }
    if (!ownerMemberId) {
      setError("Choose an active owner for this lead.");
      return;
    }
    let valueEstimatePaise: number | null = null;
    if (value.trim()) {
      valueEstimatePaise = rupeesToPaise(value);
      if (valueEstimatePaise === null) {
        setFields({ valueEstimatePaise: "Enter a rupee value with up to two decimals." });
        return;
      }
    }
    const payload: LeadInput = {
      company: company.trim(),
      contactName: nullable(contactName),
      contactEmail: nullable(contactEmail),
      contactPhone: nullable(contactPhone),
      source: nullable(source),
      ownerMemberId,
      valueEstimatePaise,
      nextAction: nullable(nextAction),
      nextActionOn: nextActionOn || null,
      notes: nullable(notes),
    };
    setLoading(true);
    try {
      if (mode === "create") {
        await apiFetch<{ lead: LeadRow }>("/api/leads", { method: "POST", body: JSON.stringify(payload) });
        onSaved("Lead created.");
      } else if (initial) {
        await apiFetch<{ lead: LeadRow }>(`/api/leads/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved("Lead updated.");
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
      title={mode === "create" ? "New lead" : "Edit lead"}
      description={mode === "create" ? "Add a company at the top of the pipeline. Stage changes are tracked separately." : "Changes are recorded in the lead timeline and audit trail."}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" variant="primary" loading={loading}>
            {mode === "create" ? "Create lead" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {!owners.length ? <InlineAlert tone="warning">No active owner is available. Ask an owner to review the team first.</InlineAlert> : null}
        <FormGrid>
          <FullWidth>
            <Field label="Company" htmlFor="lead-company" error={fields.company} required>
              <Input id="lead-company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company or organisation" required />
            </Field>
          </FullWidth>
          <Field label="Contact name" htmlFor="lead-contact" error={fields.contactName}>
            <Input id="lead-contact" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Primary contact" />
          </Field>
          <Field label="Contact email" htmlFor="lead-email" error={fields.contactEmail}>
            <Input id="lead-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label="Contact phone" htmlFor="lead-phone" error={fields.contactPhone}>
            <Input id="lead-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+91…" />
          </Field>
          <Field label="Source" htmlFor="lead-source" error={fields.source}>
            <Input id="lead-source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Referral, website, event…" />
          </Field>
          <Field label="Owner" htmlFor="lead-owner" error={fields.ownerMemberId} required>
            <Select id="lead-owner" value={ownerMemberId} onChange={(event) => setOwnerMemberId(event.target.value)} required>
              <option value="">Choose an owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimated value" htmlFor="lead-value" error={fields.valueEstimatePaise} hint="Optional, in rupees.">
            <div className="relative">
              <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
              <Input id="lead-value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} className="pl-7" placeholder="1,50,000" />
            </div>
          </Field>
          <Field label="Next action" htmlFor="lead-next" error={fields.nextAction}>
            <Input id="lead-next" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Send proposal" />
          </Field>
          <Field label="Next action date" htmlFor="lead-next-date" error={fields.nextActionOn}>
            <Input id="lead-next-date" type="date" value={nextActionOn} onChange={(event) => setNextActionOn(event.target.value)} />
          </Field>
          <FullWidth>
            <Field label="Notes" htmlFor="lead-notes" error={fields.notes}>
              <Textarea id="lead-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Context, scope, budget signals…" />
            </Field>
          </FullWidth>
        </FormGrid>
      </form>
    </Modal>
  );
}

function ConvertForm({
  lead,
  owners,
  onClose,
}: {
  lead: LeadDetail;
  owners: Lookups["owners"];
  onClose: () => void;
}) {
  const router = useRouter();
  const [serviceType, setServiceType] = React.useState<ServiceType>("awareness");
  const [ownerMemberId, setOwnerMemberId] = React.useState(lead.ownerMemberId || owners[0]?.id || "");
  const [scopeOfWork, setScopeOfWork] = React.useState("");
  const [agreementStatus, setAgreementStatus] = React.useState<AgreementStatus>("none");
  const [agreementRef, setAgreementRef] = React.useState("");
  const [agreementSignedOn, setAgreementSignedOn] = React.useState("");
  const [notes, setNotes] = React.useState(lead.notes ?? "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const result = await apiFetch<{ client: { id: string } }>(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        body: JSON.stringify({
          serviceType,
          ownerMemberId,
          scopeOfWork: nullable(scopeOfWork),
          agreementStatus,
          agreementRef: nullable(agreementRef),
          agreementSignedOn: agreementSignedOn || null,
          notes: nullable(notes),
        }),
      });
      router.push(`/clients/${result.client.id}`);
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
      title="Convert to client"
      description={`${lead.company} will become an active client. The lead history is preserved.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="convert-form" variant="primary" loading={loading} disabled={!ownerMemberId}>
            Convert &amp; open client
          </Button>
        </>
      }
    >
      <form id="convert-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        <FormGrid>
          <Field label="Service" htmlFor="convert-service" required>
            <Select id="convert-service" value={serviceType} onChange={(event) => setServiceType(event.target.value as ServiceType)}>
              <option value="awareness">Security awareness</option>
              <option value="vapt">VAPT</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Client owner" htmlFor="convert-owner" error={fields.ownerMemberId} required>
            <Select id="convert-owner" value={ownerMemberId} onChange={(event) => setOwnerMemberId(event.target.value)}>
              <option value="">Choose an owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
          </Field>
          <FullWidth>
            <Field label="Scope of work" htmlFor="convert-scope" error={fields.scopeOfWork}>
              <Textarea id="convert-scope" value={scopeOfWork} onChange={(event) => setScopeOfWork(event.target.value)} placeholder="What was sold…" />
            </Field>
          </FullWidth>
          <Field label="Agreement status" htmlFor="convert-agreement">
            <Select id="convert-agreement" value={agreementStatus} onChange={(event) => setAgreementStatus(event.target.value as AgreementStatus)}>
              <option value="none">No agreement</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="expired">Expired</option>
            </Select>
          </Field>
          <Field label="Agreement reference" htmlFor="convert-ref" error={fields.agreementRef}>
            <Input id="convert-ref" value={agreementRef} onChange={(event) => setAgreementRef(event.target.value)} placeholder="Contract / proposal ID" />
          </Field>
          <Field label="Agreement signed on" htmlFor="convert-signed" error={fields.agreementSignedOn}>
            <Input id="convert-signed" type="date" value={agreementSignedOn} onChange={(event) => setAgreementSignedOn(event.target.value)} />
          </Field>
          <FullWidth>
            <Field label="Client notes" htmlFor="convert-notes" error={fields.notes}>
              <Textarea id="convert-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </FullWidth>
        </FormGrid>
        <p className="text-[10.5px] leading-4 text-zinc-500">
          An agreement is not required to create a client. Its status can be updated later from the client record.
        </p>
      </form>
    </Modal>
  );
}

function LeadCard({
  lead,
  canWrite,
  onOpen,
  onDragStart,
}: {
  lead: LeadRow;
  canWrite: boolean;
  onOpen: () => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const overdue = Boolean(lead.nextActionOn && lead.nextActionOn < today);
  return (
    <div
      draggable={canWrite}
      onDragStart={onDragStart}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      className="group cursor-pointer rounded-xl border border-line dark:border-white/[0.08] bg-white/90 dark:bg-[#16161D] p-3 text-left shadow-card transition hover:-translate-y-px hover:border-black/20 dark:hover:border-white/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/30"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[13px] font-semibold leading-5 text-ink dark:text-zinc-100 group-hover:text-red transition-colors">{lead.company}</p>
        {canWrite ? <GripVertical className="mt-0.5 size-3.5 shrink-0 text-zinc-300 dark:text-zinc-600 opacity-0 transition group-hover:opacity-100" aria-hidden /> : null}
      </div>
      {lead.contactName ? (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <UserRound className="size-3 shrink-0" aria-hidden /> {lead.contactName}
        </p>
      ) : null}
      {lead.valueEstimatePaise != null ? (
        <p className="mt-2 font-display text-[15px] font-semibold tracking-[-0.02em] text-ink dark:text-zinc-100">{formatInr(lead.valueEstimatePaise)}</p>
      ) : null}
      {lead.nextAction ? (
        <div className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[10.5px] leading-4 ${overdue ? "border-red-200 bg-red-50/70 text-red dark:border-red/30 dark:bg-red/10 dark:text-red-300" : "border-line dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300"}`}>
          <span className="flex items-center gap-1.5 font-medium">
            <ArrowRight className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{lead.nextAction}</span>
          </span>
          <span className={`mt-0.5 flex items-center gap-1.5 pl-[18px] font-mono text-[10px] ${overdue ? "text-red/80 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}>
            <CalendarDays className="size-2.5" aria-hidden />
            {lead.nextActionOn ? relativeDays(lead.nextActionOn) : "No date set"}
          </span>
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 dark:border-white/[0.05] pt-2">
        <Avatar name={lead.ownerName} size="xs" />
        <span className="truncate text-[10.5px] font-medium text-zinc-500 dark:text-zinc-400">{shortName(lead.ownerName)}</span>
        <span className="ml-auto font-mono text-[9.5px] text-zinc-400 dark:text-zinc-500">{formatIstDate(lead.updatedAt)}</span>
      </div>
    </div>
  );
}

export function LeadsClient() {
  const { can, user } = usePortal();
  const router = useRouter();
  const canWrite = can("leads.write");
  const canDelete = can("leads.delete");
  const { data, loading, error, reload } = useApi<{ leads: LeadRow[]; count: number }>("/api/leads");
  const lookups = useApi<Lookups>(canWrite ? "/api/lookups" : null);

  const [query, setQuery] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [view, setView] = React.useState<"board" | "table">("board");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editLead, setEditLead] = React.useState<LeadRow | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deleteLead, setDeleteLead] = React.useState<LeadRow | null>(null);
  const [convertLead, setConvertLead] = React.useState<LeadDetail | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [stageBusy, setStageBusy] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<LeadStage | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const detailResponse = useApi<{ lead: LeadDetail }>(selectedId ? `/api/leads/${selectedId}` : null);
  const detail = detailResponse.data?.lead ?? null;
  const leads = data?.leads ?? [];
  const owners = lookups.data?.owners ?? [];

  const ownerOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const owner of owners) map.set(owner.id, owner.name);
    for (const lead of leads) map.set(lead.ownerMemberId, lead.ownerName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [leads, owners]);

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (ownerFilter !== "all" && lead.ownerMemberId !== ownerFilter) return false;
      if (!term) return true;
      return [lead.company, lead.contactName, lead.contactEmail, lead.source, lead.nextAction, lead.ownerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [leads, ownerFilter, query]);

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function refreshAll() {
    void reload(true);
  }

  async function moveStage(leadId: string, stage: LeadStage) {
    setActionError(null);
    setStageBusy(true);
    try {
      const result = await apiFetch<{ changed: boolean }>(`/api/leads/${leadId}/stage`, {
        method: "POST",
        body: JSON.stringify({ stage }),
      });
      if (result.changed) setNotice(`Moved to ${stageLabel(stage)}.`);
      refreshAll();
      if (selectedId === leadId) void detailResponse.reload(true);
    } catch (moveError) {
      setActionError(errorMessage(moveError));
    } finally {
      setStageBusy(false);
    }
  }

  async function onDrop(event: React.DragEvent, stage: LeadStage) {
    event.preventDefault();
    setDragOver(null);
    const id = dragId ?? event.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!id) return;
    const lead = leads.find((item) => item.id === id);
    if (!lead || lead.stage === stage) return;
    await moveStage(id, stage);
  }

  async function confirmDelete() {
    if (!deleteLead) return;
    setDeleting(true);
    setActionError(null);
    try {
      await apiFetch(`/api/leads/${deleteLead.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmName: deleteLead.company }),
      });
      setDeleteLead(null);
      setSelectedId(null);
      setNotice("Lead deleted.");
      refreshAll();
    } catch (deleteError) {
      setActionError(errorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(lead: LeadRow) {
    setSelectedId(null);
    setEditLead(lead);
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Growth" title="Leads" description="The full pipeline, from first conversation to signed work." />
        <Card className="mb-4 p-3">
          <div className="skeleton h-9 w-full rounded" />
        </Card>
        <TableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Growth" title="Leads" />
        <ErrorState message={error} onRetry={() => void reload()} />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Growth"
        title="Leads"
        description="The full pipeline, from first conversation to signed work. Drag a card to move its stage."
        actions={
          canWrite ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> New lead
            </Button>
          ) : null
        }
      />

      {notice ? <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert> : null}
      {actionError ? <InlineAlert tone="error" className="mb-4">{actionError}</InlineAlert> : null}

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <SearchField value={query} onChange={setQuery} placeholder="Search leads, contacts, next action…" className="lg:max-w-sm" />
          <div className="flex items-center gap-2">
            <Select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              aria-label="Filter by owner"
              className="w-auto min-w-[150px]"
            >
              <option value="all">All owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
            <span className="whitespace-nowrap text-[11px] text-zinc-500">
              {filtered.length} of {leads.length}
            </span>
          </div>
          <div className="ml-auto flex items-center rounded-lg border border-line dark:border-white/10 bg-zinc-100/70 dark:bg-white/[0.04] p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setView("board")}
              className={`flex h-7 items-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition ${view === "board" ? "bg-white dark:bg-[#1A1A24] text-ink dark:text-white shadow-sm" : "text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200"}`}
              aria-pressed={view === "board"}
            >
              <LayoutGrid className="size-3.5" aria-hidden /> Board
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`flex h-7 items-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition ${view === "table" ? "bg-white dark:bg-[#1A1A24] text-ink dark:text-white shadow-sm" : "text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200"}`}
              aria-pressed={view === "table"}
            >
              <List className="size-3.5" aria-hidden /> Table
            </button>
          </div>
        </div>
      </Card>

      {!leads.length ? (
        <Card>
          <EmptyState
            icon={Target}
            title="No leads yet"
            description={canWrite ? "Create the first lead to start building the pipeline." : "Leads created by the team will appear here."}
            action={canWrite ? <Button variant="primary" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New lead</Button> : null}
          />
        </Card>
      ) : view === "board" ? (
        <div className="flex gap-3.5 overflow-x-auto pb-4 apt-scroll 2xl:grid 2xl:grid-cols-5 2xl:overflow-visible">
          {STAGES.map((stage) => {
            const stageLeads = filtered.filter((lead) => lead.stage === stage.key);
            const totalValue = stageLeads.reduce((sum, lead) => sum + Number(lead.valueEstimatePaise ?? 0), 0);
            return (
              <section
                key={stage.key}
                onDragOver={(event) => {
                  if (!canWrite) return;
                  event.preventDefault();
                  setDragOver(stage.key);
                }}
                onDragLeave={() => setDragOver((current) => (current === stage.key ? null : current))}
                onDrop={(event) => void onDrop(event, stage.key)}
                className={`flex min-w-[275px] flex-1 flex-col rounded-2xl border bg-[#F8F7F4]/80 dark:bg-[#111116] transition-colors ${
                  dragOver === stage.key ? "border-red/40 bg-red-50/40 dark:bg-red/10" : "border-line dark:border-white/[0.08]"
                }`}
              >
                <header className="flex items-center gap-2 px-3.5 py-3 border-b border-line/60 dark:border-white/[0.04]">
                  <span className={`size-2 rounded-full ${stage.dot}`} aria-hidden />
                  <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-700 dark:text-zinc-300">{stage.label}</h2>
                  <span className="rounded-full bg-white dark:bg-white/[0.08] px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums text-zinc-600 dark:text-zinc-300 shadow-sm border border-black/5 dark:border-white/10">{stageLeads.length}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {totalValue ? formatInrCompact(totalValue) : "—"}
                  </span>
                </header>
                <div className="flex-1 space-y-2.5 p-2.5">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      canWrite={canWrite}
                      onOpen={() => setSelectedId(lead.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", lead.id);
                        setDragId(lead.id);
                      }}
                    />
                  ))}
                  {!stageLeads.length ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-7 text-center">
                      <p className="text-[10.5px] text-zinc-400">{query || ownerFilter !== "all" ? "No matches" : "No leads here"}</p>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Lead</TH>
                <TH>Stage</TH>
                <TH>Owner</TH>
                <TH className="text-right">Value</TH>
                <TH>Next action</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((lead) => (
                <TR key={lead.id} onClick={() => setSelectedId(lead.id)}>
                  <TD>
                    <p className="text-[12.5px] font-medium text-ink">{lead.company}</p>
                    <p className="text-[10.5px] text-zinc-500">{lead.contactName || lead.source || "—"}</p>
                  </TD>
                  <TD><StatusBadge value={lead.stage} /></TD>
                  <TD><span className="flex items-center gap-1.5 text-[11.5px]"><Avatar name={lead.ownerName} size="xs" /> {shortName(lead.ownerName)}</span></TD>
                  <TD className="text-right tabular-nums">{lead.valueEstimatePaise != null ? formatInr(lead.valueEstimatePaise) : "—"}</TD>
                  <TD>
                    <p className="max-w-[220px] truncate text-[11.5px]">{lead.nextAction || "—"}</p>
                    <p className={`text-[10px] ${lead.nextActionOn && lead.nextActionOn < new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) ? "text-red" : "text-zinc-400"}`}>
                      {lead.nextActionOn ? relativeDays(lead.nextActionOn) : ""}
                    </p>
                  </TD>
                  <TD className="whitespace-nowrap text-[11px] text-zinc-500">{formatIstDate(lead.updatedAt)}</TD>
                </TR>
              ))}
              {!filtered.length ? (
                <TR>
                  <TD className="py-10 text-center text-zinc-500" colSpan={6}>
                    No leads match these filters.
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </TableWrap>
      )}

      <Modal
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={detail?.company ?? "Lead"}
        description={detail ? `${stageLabel(detail.stage)} · Owned by ${detail.ownerName}` : "Loading lead record…"}
        size="xl"
        footer={
          detail ? (
            <>
              {canDelete ? (
                <Button variant="ghost" className="mr-auto text-red hover:bg-red-50 hover:text-red" onClick={() => setDeleteLead(detail)}>
                  <Trash2 className="size-3.5" aria-hidden /> Delete
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setSelectedId(null)}>Close</Button>
              {canWrite ? (
                <Button variant="outline" onClick={() => openEdit(detail)}>
                  <Pencil className="size-3.5" aria-hidden /> Edit
                </Button>
              ) : null}
              {can("clients.write") && detail.stage === "won" && !detail.convertedClientId ? (
                <Button variant="primary" onClick={() => { setConvertLead(detail); setSelectedId(null); }}>
                  Convert to client <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {detailResponse.loading ? (
          <TableSkeleton rows={6} cols={2} />
        ) : detailResponse.error ? (
          <ErrorState message={detailResponse.error} onRetry={() => void detailResponse.reload()} />
        ) : detail ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-zinc-50/70 px-3 py-2.5">
              <StatusBadge value={detail.stage} />
              <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{formatInr(detail.valueEstimatePaise)}</span>
              <span className="text-[10.5px] text-zinc-500">estimated value</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10.5px] text-zinc-500">Move stage</span>
                <Select
                  value={detail.stage}
                  disabled={!canWrite || stageBusy}
                  onChange={(event) => void moveStage(detail.id, event.target.value as LeadStage)}
                  className="h-8 w-auto min-w-[130px] text-[11.5px]"
                  aria-label="Lead stage"
                >
                  {STAGES.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {detail.convertedClientId ? (
              <InlineAlert tone="success">
                <span className="flex flex-wrap items-center gap-2">
                  This lead has been converted to a client.
                  <Link href={`/clients/${detail.convertedClientId}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                    Open client <ExternalLink className="size-3" aria-hidden />
                  </Link>
                </span>
              </InlineAlert>
            ) : null}

            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <Detail label="Contact">
                {detail.contactName ? (
                  <span>
                    {detail.contactName}
                    {detail.contactEmail ? (
                      <a href={`mailto:${detail.contactEmail}`} className="block break-all text-[11.5px] text-info hover:underline">
                        {detail.contactEmail}
                      </a>
                    ) : null}
                    {detail.contactPhone ? <span className="block text-[11.5px] text-zinc-500">{detail.contactPhone}</span> : null}
                  </span>
                ) : null}
              </Detail>
              <Detail label="Owner">
                <span className="flex items-center gap-2"><Avatar name={detail.ownerName} size="xs" /> {detail.ownerName}</span>
              </Detail>
              <Detail label="Source">{detail.source}</Detail>
              <Detail label="Next action">{detail.nextAction}</Detail>
              <Detail label="Next action date">{detail.nextActionOn ? `${formatIstDate(detail.nextActionOn)} · ${relativeDays(detail.nextActionOn)}` : null}</Detail>
              <Detail label="Last updated">{formatDateTime(detail.updatedAt)}</Detail>
            </dl>

            {detail.notes ? (
              <div>
                <p className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-zinc-500">Notes</p>
                <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-line bg-white p-3 text-[12px] leading-5 text-zinc-600">{detail.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.07em] text-zinc-500">Stage history</p>
              {detail.events.length ? (
                <ol className="space-y-3 border-l border-line pl-4">
                  {detail.events.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2 rounded-full border border-white bg-zinc-300 ring-1 ring-line" aria-hidden />
                      <p className="text-[11.5px] text-ink">
                        {event.fromStage ? `${stageLabel(event.fromStage)} → ${stageLabel(event.toStage ?? event.fromStage)}` : `Created in ${stageLabel(event.toStage ?? "identified")}`}
                      </p>
                      {event.note ? <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{event.note}</p> : null}
                      <p className="mt-0.5 text-[9.5px] text-zinc-400">
                        {event.memberName ?? "System"} · {formatDateTime(event.occurredAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[11.5px] text-zinc-500">No stage events recorded.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {createOpen ? (
        <LeadForm
          mode="create"
          owners={owners}
          onClose={() => setCreateOpen(false)}
          onSaved={(message) => {
            setCreateOpen(false);
            setNotice(message);
            refreshAll();
          }}
        />
      ) : null}

      {editLead ? (
        <LeadForm
          mode="edit"
          initial={editLead}
          owners={owners}
          onClose={() => setEditLead(null)}
          onSaved={(message) => {
            setEditLead(null);
            setNotice(message);
            refreshAll();
          }}
        />
      ) : null}

      {convertLead ? <ConvertForm lead={convertLead} owners={owners} onClose={() => setConvertLead(null)} /> : null}

      <ConfirmDialog
        open={Boolean(deleteLead)}
        onOpenChange={(open) => !open && setDeleteLead(null)}
        title="Delete lead"
        description={
          <>
            This soft-deletes <strong>{deleteLead?.company}</strong>. The record and its history remain in the database and
            audit trail, but disappear from the pipeline.
          </>
        }
        confirmWord={deleteLead?.company ?? ""}
        confirmLabel="Delete lead"
        onConfirm={() => void confirmDelete()}
        loading={deleting}
      />

      {user.accessLevel === "viewer" ? (
        <p className="mt-4 flex items-center gap-1.5 text-[10.5px] text-zinc-400">
          <Target className="size-3" aria-hidden /> You have read-only access to leads.
        </p>
      ) : null}
    </div>
  );
}
