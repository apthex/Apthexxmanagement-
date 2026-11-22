import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Tasks · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  await requirePageAccess("tasks.read", "/tasks");
  return (
    <ComingSoon
      title="Task Operations & Sprints"
      badge="Launching Q1 2026"
      description="Sprint tracking, cross-functional engineering and operations backlog, blocker management, and milestone burn-downs."
      features={[
        { title: "Sprint Backlog", desc: "Priority-ranked backlog with story points, due dates, and sprint milestones." },
        { title: "Blocker Resolution", desc: "Instant escalation notifications for blocked dependencies across workstreams." },
        { title: "Assignee Workload", desc: "Team capacity distribution, open ticket counts, and cycle time metrics." },
        { title: "Automated Checklists", desc: "Standard operating procedures and security sign-off checklists." },
      ]}
    />
  );
}
