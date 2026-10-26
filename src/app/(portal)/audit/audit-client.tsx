"use client";

import * as React from "react";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
} from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatIstDateTime } from "@/lib/dates";
import type { AuditData, AuditEventRow, Lookups } from "@/lib/portal-types";
import {
  Card,
  EmptyState,
  ErrorState,
  InlineAlert,
  PageHeader,
  SearchField,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function formatAuditDetail(event: AuditEventRow): React.ReactNode {
  const { action, detail, outcome, entityType, entityId } = event;
  const isDenied = outcome === "denied";

  if (!detail || Object.keys(detail).length === 0) {
    if (entityType && entityId) {
      return (
        <span className="font-mono text-[12px] text-zinc-600">
          {entityType} {entityId.slice(0, 8)}
        </span>
      );
    }
    return <span className="text-zinc-400">—</span>;
  }

  // Format known details
  const parts: string[] = [];

  if (typeof detail.path === "string") {
    parts.push(detail.path);
  }
  if (typeof detail.reason === "string") {
    parts.push(detail.reason);
  }
  if (typeof detail.summary === "string") {
    parts.push(detail.summary);
  }
  if (typeof detail.email === "string") {
    parts.push(detail.email);
  }
  if (typeof detail.attemptNumber === "number") {
    parts.push(`Attempt ${detail.attemptNumber}`);
  }
  if (typeof detail.newDevice === "boolean" && detail.newDevice) {
    parts.push("new device");
  }
  if (detail.before && detail.after && typeof detail.before === "object" && typeof detail.after === "object") {
    const beforeObj = detail.before as Record<string, unknown>;
    const afterObj = detail.after as Record<string, unknown>;
    const changes: string[] = [];
    for (const key of Object.keys(afterObj)) {
      if (beforeObj[key] !== afterObj[key] && beforeObj[key] !== undefined) {
        changes.push(`${key}: ${String(beforeObj[key])} → ${String(afterObj[key])}`);
      }
    }
    if (changes.length) {
      parts.push(changes.join(", "));
    }
  }

  const text = parts.length > 0 ? parts.join(" · ") : JSON.stringify(detail);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {entityType && entityId ? (
        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 mr-1">
          {entityType}:{entityId.slice(0, 8)}
        </span>
      ) : null}
      <span className={isDenied ? "text-red dark:text-red-400 font-medium" : "text-zinc-700 dark:text-zinc-300"}>
        {text}
      </span>
      {isDenied && (
        <Badge tone="red" className="text-[10px] px-1.5 py-0 h-4 font-mono">
          denied
        </Badge>
      )}
    </div>
  );
}

export function AuditClient() {
  const [memberId, setMemberId] = React.useState<string>("");
  const [action, setAction] = React.useState<string>("");
  const [outcome, setOutcome] = React.useState<string>("");
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [page, setPage] = React.useState<number>(1);
  const pageSize = 50;

  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (memberId) queryParams.set("memberId", memberId);
  if (action) queryParams.set("action", action);
  if (outcome) queryParams.set("outcome", outcome);
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  if (searchTerm) queryParams.set("q", searchTerm);

  const { data, loading, error, reload } = useApi<AuditData>(
    `/api/audit?${queryParams.toString()}`,
  );
  const { data: lookups } = useApi<Lookups>("/api/lookups");

  const handleExport = () => {
    const exportParams = new URLSearchParams();
    if (memberId) exportParams.set("memberId", memberId);
    if (action) exportParams.set("action", action);
    if (outcome) exportParams.set("outcome", outcome);
    if (from) exportParams.set("from", from);
    if (to) exportParams.set("to", to);
    if (searchTerm) exportParams.set("q", searchTerm);

    window.location.href = `/api/audit/export?${exportParams.toString()}`;
  };

  const resetFilters = () => {
    setMemberId("");
    setAction("");
    setOutcome("");
    setFrom("");
    setTo("");
    setSearchTerm("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security & Compliance"
        title="Audit Log"
        description="Immutable system-wide audit trail. Logs all reads, writes, auth attempts, and denied requests. Read-only for owners."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
              <Download className="mr-1.5 size-4" />
              Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void reload()} className="h-9">
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-sm flex-1">
            <SearchField
              placeholder="Search actions, IP, actor, details..."
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[130px] text-[12px]"
            >
              <option value="">All Outcomes</option>
              <option value="denied">Denied Only</option>
              <option value="allowed">Allowed Only</option>
            </Select>

            <Select
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[160px] text-[12px]"
            >
              <option value="">All Members</option>
              {lookups?.people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>

            <Input
              type="date"
              placeholder="From"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[135px] text-[12px]"
            />

            <Input
              type="date"
              placeholder="To"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[135px] text-[12px]"
            />

            {(memberId || action || outcome || from || to || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 text-[12px] text-zinc-500 hover:text-ink"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[12px] text-zinc-500 border-t border-line/60 pt-2.5">
          <span>
            Showing page {data?.page ?? 1} of {data?.pages ?? 1} ({data?.total ?? 0} total events)
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 text-[11px]"
            >
              <ChevronLeft className="size-3.5 mr-0.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || page >= data.pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-2 text-[11px]"
            >
              Next
              <ChevronRight className="size-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Audit Log Table matching PDF Screen 6.10 */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data || data.events.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit events found"
          description="No activity matches your filter criteria."
        />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH className="w-[160px]">When</TH>
                <TH className="w-[140px]">Who</TH>
                <TH className="w-[140px]">Action</TH>
                <TH>Detail</TH>
                <TH className="w-[130px] text-right font-mono text-[11px]">IP Address</TH>
              </TR>
            </THead>
            <TBody>
              {data.events.map((evt) => {
                const isDenied = evt.outcome === "denied";
                const who = evt.memberEmail
                  ? evt.memberEmail.split("@")[0] + "@"
                  : evt.memberName ?? "unknown";

                return (
                  <TR
                    key={evt.id}
                    className={isDenied ? "bg-red-50/40 hover:bg-red-50/60 dark:bg-red/10 dark:hover:bg-red/15" : undefined}
                  >
                    <TD className="whitespace-nowrap font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
                      {formatIstDateTime(evt.occurredAt)}
                    </TD>

                    <TD className="whitespace-nowrap font-medium text-zinc-800 dark:text-zinc-200">
                      {who}
                    </TD>

                    <TD className="whitespace-nowrap font-mono text-[11px] font-semibold text-ink dark:text-zinc-100">
                      {evt.action}
                    </TD>

                    <TD>
                      {formatAuditDetail(evt)}
                    </TD>

                    <TD className="whitespace-nowrap text-right font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {evt.ip ?? "—"}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
