"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { apiFetch, errorMessage, fieldErrors } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatIstDate } from "@/lib/dates";
import type {
  FinanceCategory,
  FinanceData,
  FinanceDirection,
  FinanceEntryRow,
  Lookups,
} from "@/lib/portal-types";
import { usePortal } from "@/components/portal/context";
import {
  Card,
  EmptyState,
  ErrorState,
  FormGrid,
  FullWidth,
  InlineAlert,
  PageHeader,
  SearchField,
  StatCard,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/table";

const CATEGORIES: { value: FinanceCategory; label: string }[] = [
  { value: "services", label: "Services" },
  { value: "tools", label: "Tools" },
  { value: "payroll", label: "Payroll" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
];

function CategoryBadge({ category }: { category: FinanceCategory }) {
  const labels: Record<FinanceCategory, string> = {
    services: "Services",
    tools: "Tools",
    payroll: "Payroll",
    infrastructure: "Infrastructure",
    travel: "Travel",
    other: "Other",
  };
  return (
    <Badge tone="neutral" className="border-line font-medium text-zinc-700">
      {labels[category] ?? category}
    </Badge>
  );
}

function AddEntryModal({
  open,
  onClose,
  clients,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  clients: Lookups["clients"];
  onSaved: () => void;
}) {
  const [entryDate, setEntryDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = React.useState<FinanceDirection>("in");
  const [amountRupees, setAmountRupees] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<FinanceCategory>("services");
  const [clientId, setClientId] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});

    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    const amountPaise = Math.round(rupees * 100);

    setSaving(true);
    try {
      await apiFetch("/api/finance", {
        method: "POST",
        body: JSON.stringify({
          entryDate,
          direction,
          amountPaise,
          description: description.trim(),
          category,
          clientId: clientId ? clientId : null,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setErrors(fieldErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(val) => {
        if (!val) onClose();
      }}
      title="Add Finance Entry"
      description="Record a manual income or expense entry. Amounts are stored as integer paise."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <FormGrid>
          <Field label="Entry Date" error={errors.entryDate}>
            <Input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Direction" error={errors.direction}>
            <Select
              value={direction}
              onChange={(e) => setDirection(e.target.value as FinanceDirection)}
            >
              <option value="in">Income (In)</option>
              <option value="out">Expense (Out)</option>
            </Select>
          </Field>
        </FormGrid>

        <FormGrid>
          <Field label="Amount (₹)" error={errors.amountPaise}>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 150000"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              required
            />
          </Field>

          <Field label="Category" error={errors.category}>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as FinanceCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>

        <FullWidth>
          <Field label="Description" error={errors.description}>
            <Input
              type="text"
              placeholder="e.g. BrandGoesUp — Oct retainer"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </Field>
        </FullWidth>

        <FullWidth>
          <Field label="Associated Client (Optional)" error={errors.clientId}>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">None (General Company)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company}
                </option>
              ))}
            </Select>
          </Field>
        </FullWidth>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Add entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ReverseEntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: FinanceEntryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [confirmName, setConfirmName] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName !== entry.description) {
      setError("Please type the entry description exactly to confirm reversal.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/finance/${entry.id}/reverse`, {
        method: "POST",
        body: JSON.stringify({
          confirmName: confirmName.trim(),
          reason: reason.trim(),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(entry)}
      onOpenChange={(val) => {
        if (!val) onClose();
      }}
      title="Reverse Finance Entry"
      description="Finance entries are never deleted. A reversal creates an opposite balancing entry with reference to the original."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <div className="rounded-lg border border-line dark:border-white/10 bg-zinc-50 dark:bg-white/[0.04] p-3 text-[13px] text-zinc-600 dark:text-zinc-300">
          <p>
            <strong className="text-ink dark:text-white">Entry to reverse:</strong> {entry.description}
          </p>
          <p className="mt-1">
            <strong className="text-ink dark:text-white">Amount:</strong> ₹
            {(entry.amountPaise / 100).toLocaleString("en-IN")} ({entry.direction.toUpperCase()})
          </p>
        </div>

        <Field label="Reason for Reversal">
          <Textarea
            rows={2}
            placeholder="e.g. Duplicate entry or corrected invoice"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </Field>

        <Field
          label={`Type "${entry.description}" to confirm:`}
          hint="To prevent accidental corrections, please type the exact description."
        >
          <Input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            required
            autoComplete="off"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={submitting || confirmName !== entry.description}
          >
            {submitting ? "Reversing..." : "Confirm Reversal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function FinanceClient() {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = React.useState(currentMonthStr);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("");
  const [directionFilter, setDirectionFilter] = React.useState<string>("");

  const [addOpen, setAddOpen] = React.useState(false);
  const [reversingEntry, setReversingEntry] = React.useState<FinanceEntryRow | null>(null);

  const queryParams = new URLSearchParams({ month });
  if (searchTerm) queryParams.set("q", searchTerm);
  if (categoryFilter) queryParams.set("category", categoryFilter);
  if (directionFilter) queryParams.set("direction", directionFilter);

  const { data, loading, error, reload } = useApi<FinanceData>(
    `/api/finance?${queryParams.toString()}`,
  );
  const { data: lookups } = useApi<Lookups>("/api/lookups");

  const changeMonth = (offset: number) => {
    const [y, m] = month.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1 + offset, 1));
    const nextMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    setMonth(nextMonth);
  };

  const handleExport = () => {
    const url = `/api/finance/export?month=${encodeURIComponent(month)}`;
    window.location.href = url;
  };

  const inRupees = data ? data.totals.inPaise / 100 : 0;
  const outRupees = data ? data.totals.outPaise / 100 : 0;
  const netRupees = data ? data.totals.netPaise / 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company Ledger"
        title={`Finance — ${data?.monthLabel ?? month}`}
        description="Manual financial records. Amounts are immutable; corrections require a reversing entry."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-line dark:border-white/10 bg-white/80 dark:bg-[#16161D] shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-zinc-600 hover:text-ink dark:text-zinc-300 dark:hover:text-white"
                onClick={() => changeMonth(-1)}
                title="Previous Month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-3 font-mono text-[12.5px] font-semibold text-ink dark:text-white">
                {data?.monthLabel ?? month}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-zinc-600 hover:text-ink dark:text-zinc-300 dark:hover:text-white"
                onClick={() => changeMonth(1)}
                title="Next Month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 font-medium">
              <Download className="mr-1.5 size-4" />
              Export CSV
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-9"
            >
              <Plus className="mr-1.5 size-4" />
              Add entry
            </Button>
          </div>
        }
      />

      {/* 3 Metric Summary Cards matching PDF Screen 6.8 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="IN (Income)"
          value={`₹${inRupees.toLocaleString("en-IN")}`}
          accent="green"
          icon={ArrowDownRight}
          meta={<span className="text-ok font-medium">Cash inflows for {data?.monthLabel ?? "month"}</span>}
        />
        <StatCard
          label="OUT (Expenses)"
          value={`₹${outRupees.toLocaleString("en-IN")}`}
          accent="default"
          icon={ArrowUpRight}
          meta={<span className="text-zinc-500 font-medium">Cash outflows for {data?.monthLabel ?? "month"}</span>}
        />
        <StatCard
          label="NET (Balance)"
          value={`${netRupees >= 0 ? "+" : "−"}₹${Math.abs(netRupees).toLocaleString("en-IN")}`}
          accent={netRupees >= 0 ? "green" : "red"}
          icon={IndianRupee}
          meta={
            <span className={netRupees >= 0 ? "text-ok font-medium" : "text-red font-medium"}>
              {netRupees >= 0 ? "Net Surplus" : "Net Deficit"}
            </span>
          }
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] max-w-sm flex-1">
              <SearchField
                placeholder="Search description or client..."
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>

            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 w-[150px] text-[12px]"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>

            <Select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="h-9 w-[130px] text-[12px]"
            >
              <option value="">All Directions</option>
              <option value="in">Income Only</option>
              <option value="out">Expense Only</option>
            </Select>
          </div>

          <div className="text-[12px] font-medium text-zinc-500">
            {data ? `${data.count} ${data.count === 1 ? "entry" : "entries"}` : "—"}
          </div>
        </div>
      </Card>

      {/* Ledger Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="No finance entries found"
          description={`No recorded entries for ${data?.monthLabel ?? month} matching your filters.`}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1.5 size-4" />
              Add first entry
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH className="w-[110px]">Date</TH>
                  <TH>Description</TH>
                  <TH className="w-[140px]">Category</TH>
                  <TH className="w-[160px]">Client</TH>
                  <TH className="w-[140px] text-right">Amount</TH>
                  <TH className="w-[100px] text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {data.entries.map((entry) => {
                  const isIn = entry.direction === "in";
                  const isReversal = Boolean(entry.reversesEntryId);
                  const amountRupees = entry.amountPaise / 100;

                  return (
                    <TR key={entry.id} className={isReversal ? "bg-zinc-50/60" : undefined}>
                      <TD className="whitespace-nowrap font-medium text-zinc-600">
                        {formatIstDate(entry.entryDate)}
                      </TD>

                      <TD>
                        <div className="flex flex-col">
                          <span className="font-medium text-ink">{entry.description}</span>
                          {isReversal ? (
                            <span className="text-[11px] font-normal text-zinc-400">
                              Reversal of previous entry
                            </span>
                          ) : null}
                        </div>
                      </TD>

                      <TD>
                        <CategoryBadge category={entry.category} />
                      </TD>

                      <TD className="text-zinc-600">
                        {entry.clientName ? (
                          <span className="font-medium text-ink">{entry.clientName}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </TD>

                      <TD
                        className={`whitespace-nowrap text-right font-display font-semibold ${
                          isIn ? "text-ok" : "text-ink"
                        }`}
                      >
                        {isIn ? "+" : "−"}₹{amountRupees.toLocaleString("en-IN")}
                      </TD>

                      <TD className="text-right">
                        {!isReversal ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-zinc-500 hover:text-red"
                            onClick={() => setReversingEntry(entry)}
                            title="Reverse entry"
                          >
                            <RotateCcw className="mr-1 size-3" />
                            Reverse
                          </Button>
                        ) : (
                          <span className="text-[11px] italic text-zinc-400">Reversed</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {/* Add Entry Modal */}
      <AddEntryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        clients={lookups?.clients ?? []}
        onSaved={() => void reload()}
      />

      {/* Reverse Entry Modal */}
      <ReverseEntryModal
        entry={reversingEntry}
        onClose={() => setReversingEntry(null)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
