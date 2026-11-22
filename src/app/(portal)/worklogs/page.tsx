import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Work Logs · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function WorklogsPage() {
  await requirePageAccess("worklogs.write_own", "/worklogs");
  return (
    <ComingSoon
      title="Work Logs & Timesheets"
      badge="Launching Q1 2026"
      description="Daily contribution logs, billable and non-billable hours tracking, project attribution, and peer review verification."
      features={[
        { title: "Daily Log Entries", desc: "Structured summaries of accomplishments, blockers, and next-day commitments." },
        { title: "Project Time Tracking", desc: "Accurate hour attribution across institutional and internal client deliverables." },
        { title: "Manager Approvals", desc: "Weekly review workflows with one-click sign-off and audit history." },
        { title: "Exportable Timesheets", desc: "Ready-to-bill monthly CSV/PDF rollups for finance reconciliation." },
      ]}
    />
  );
}
