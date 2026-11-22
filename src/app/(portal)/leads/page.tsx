import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Leads · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requirePageAccess("leads.read", "/leads");
  return (
    <ComingSoon
      title="Leads Pipeline & Growth CRM"
      badge="Launching Q1 2026"
      description="Institutional outreach pipeline, partner opportunities, qualification stages, and deal velocity tracking."
      features={[
        { title: "Kanban Pipeline", desc: "Identified, Talking, Pitched, Won, and Lost deal progression stages." },
        { title: "Lead Scoring", desc: "AI-assisted institution fit score, safety urgency indicators, and deal value metrics." },
        { title: "Outreach History", desc: "Call notes, email logs, proposal attachments, and next action reminders." },
        { title: "Conversion Analytics", desc: "Funnel win-rates, stage conversion times, and growth rep attribution." },
      ]}
    />
  );
}
