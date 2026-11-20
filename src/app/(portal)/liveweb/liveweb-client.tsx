"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  Globe,
  Monitor,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { LiveWebResult } from "@/lib/data/liveweb";
import {
  Card,
  EmptyState,
  ErrorState,
  InlineAlert,
  PageHeader,
  StatCard,
  TableSkeleton,
} from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR, TableWrap } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function LiveWebClient() {
  const [range, setRange] = React.useState<"live" | "today" | "7d" | "30d">("live");
  const { data, loading, error, reload } = useApi<LiveWebResult>(`/api/liveweb?range=${range}`);

  const handleExport = () => {
    window.location.href = `/api/liveweb/export?range=${range}`;
  };

  const topSource = React.useMemo(() => {
    if (!data || !data.available || data.topSources.length === 0) return "—";
    return data.topSources[0]?.label ?? "—";
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Web Analytics"
        title="apthex.com"
        description="Real-time and historic visitor logs on the public website. Pulled server-side from Matomo API; IP addresses and geolocations included."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-line dark:border-white/10 bg-white/80 dark:bg-[#16161D] p-0.5 shadow-sm">
              <Button
                variant={range === "live" ? "subtle" : "ghost"}
                size="sm"
                className={`h-7 px-3 text-[12px] font-mono ${range === "live" ? "bg-ink dark:bg-white text-white dark:text-zinc-950 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white"}`}
                onClick={() => setRange("live")}
              >
                Live
              </Button>
              <Button
                variant={range === "7d" ? "subtle" : "ghost"}
                size="sm"
                className={`h-7 px-3 text-[12px] font-mono ${range === "7d" ? "bg-ink dark:bg-white text-white dark:text-zinc-950 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white"}`}
                onClick={() => setRange("7d")}
              >
                7 days
              </Button>
              <Button
                variant={range === "30d" ? "subtle" : "ghost"}
                size="sm"
                className={`h-7 px-3 text-[12px] font-mono ${range === "30d" ? "bg-ink dark:bg-white text-white dark:text-zinc-950 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-ink dark:hover:text-white"}`}
                onClick={() => setRange("30d")}
              >
                30 days
              </Button>
            </div>

            {data?.available ? (
              <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
                <Download className="mr-1.5 size-3.5" />
                Export CSV
              </Button>
            ) : null}

            <Button variant="ghost" size="sm" onClick={() => void reload()} className="h-8" title="Refresh">
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        }
      />

      {loading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : !data?.available ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-warn dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="mt-4 font-display text-[19px] font-semibold text-ink dark:text-white">
            Analytics Telemetry Unavailable
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-zinc-500 dark:text-zinc-400">
            {data?.reason === "not_configured"
              ? "Matomo analytics integration is awaiting configuration with MATOMO_URL, MATOMO_TOKEN, and MATOMO_SITE_ID environment variables."
              : "Unable to reach the Matomo server. The external analytics API is temporarily unreachable or returning an error."}
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry Connection
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 4 Metric Summary Cards matching PDF Screen 6.11 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="ON SITE NOW"
              value={data.liveNow}
              accent="red"
              icon={Activity}
              meta={<span className="text-red font-medium">Active in last 5m</span>}
            />
            <StatCard
              label="TODAY"
              value={data.todayVisits.toLocaleString("en-IN")}
              accent="default"
              icon={Users}
              meta="Unique visits today"
            />
            <StatCard
              label={range === "30d" ? "30 DAYS" : "7 DAYS"}
              value={data.totalVisits.toLocaleString("en-IN")}
              accent="default"
              icon={TrendingUp}
              meta="Total period visits"
            />
            <StatCard
              label="TOP SOURCE"
              value={topSource}
              accent="blue"
              icon={Globe}
              meta="Leading traffic channel"
            />
          </div>

          {/* Live / Recent Visitors Table */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-[15px] font-semibold text-ink">
                Live & Recent Visitors
              </h2>
              <p className="mt-0.5 text-[11.5px] text-zinc-500">
                Visitor-level telemetry with obfuscated IP, location, device, and landing page.
              </p>
            </div>

            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH className="w-[130px] font-mono text-[11px]">IP</TH>
                    <TH className="w-[160px]">Location</TH>
                    <TH className="w-[180px]">Device</TH>
                    <TH>Page</TH>
                    <TH className="w-[140px]">Source</TH>
                    <TH className="w-[100px] text-right">Time</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.visitors.length === 0 ? (
                    <TR>
                      <TD colSpan={6} className="py-8 text-center text-zinc-400">
                        No active visitor sessions recorded in this time window.
                      </TD>
                    </TR>
                  ) : (
                    data.visitors.map((v, idx) => (
                      <TR key={`${v.ip}-${idx}`}>
                        <TD className="whitespace-nowrap font-mono text-[11.5px] text-zinc-600">
                          {v.ip}
                        </TD>
                        <TD className="text-zinc-700">{v.location || "—"}</TD>
                        <TD className="text-zinc-600 text-[12px]">{v.device}</TD>
                        <TD className="font-mono text-[11.5px] text-zinc-700 font-medium">
                          {v.page}
                        </TD>
                        <TD className="text-zinc-600">{v.source}</TD>
                        <TD className="whitespace-nowrap text-right font-mono text-[11.5px] text-zinc-500">
                          {formatSeconds(v.timeOnSite)}
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableWrap>
          </Card>

          {/* Rollup Tables: Top Pages and Sources side by side */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Top Pages */}
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <h3 className="font-display text-[14px] font-semibold text-ink">Top Pages</h3>
              </div>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Page</TH>
                      <TH className="w-[100px] text-right">Views</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.topPages.length === 0 ? (
                      <TR>
                        <TD colSpan={2} className="py-6 text-center text-zinc-400">
                          No page views recorded.
                        </TD>
                      </TR>
                    ) : (
                      data.topPages.slice(0, 8).map((p) => (
                        <TR key={p.label}>
                          <TD className="font-mono text-[12px] text-zinc-700">{p.label}</TD>
                          <TD className="text-right font-display font-semibold text-ink">
                            {p.visits.toLocaleString("en-IN")}
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </TableWrap>
            </Card>

            {/* Top Sources */}
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <h3 className="font-display text-[14px] font-semibold text-ink">Traffic Sources</h3>
              </div>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Source</TH>
                      <TH className="w-[100px] text-right">Visits</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.topSources.length === 0 ? (
                      <TR>
                        <TD colSpan={2} className="py-6 text-center text-zinc-400">
                          No referrers recorded.
                        </TD>
                      </TR>
                    ) : (
                      data.topSources.slice(0, 8).map((s) => (
                        <TR key={s.label}>
                          <TD className="text-zinc-700 font-medium">{s.label}</TD>
                          <TD className="text-right font-display font-semibold text-ink">
                            {s.visits.toLocaleString("en-IN")}
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </TableWrap>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
