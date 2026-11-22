import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Meetings · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  await requirePageAccess("meetings.read", "/meetings");
  return (
    <ComingSoon
      title="Meetings & Stakeholder Sync"
      badge="Launching Q1 2026"
      description="Operational briefing schedules, institute demos, internal retrospectives, and recorded action item logs."
      features={[
        { title: "Institutional Demos", desc: "Pre-configured agenda templates for educational leadership presentations." },
        { title: "Calendar Sync", desc: "Bi-directional integration with enterprise calendar systems and Google Workspace." },
        { title: "Action Item Tracking", desc: "Decisions and tasks extracted from meetings automatically synced to the backlog." },
        { title: "Executive Minutes", desc: "Searchable markdown archives of leadership meeting transcripts and approvals." },
      ]}
    />
  );
}
