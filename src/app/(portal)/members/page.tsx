import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Members · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await requirePageAccess("members.read", "/members");
  return (
    <ComingSoon
      title="Team Directory & Access Management"
      badge="Launching Q1 2026"
      description="Role-based permissions management, department rosters, team credential resets, and session revocations."
      features={[
        { title: "Granular RBAC", desc: "Fine-grained permission controls across Owner, Team, Growth, and Viewer roles." },
        { title: "Team Directory", desc: "Verified member profiles, job titles, department assignments, and contact channels." },
        { title: "Security Credentials", desc: "Hardware key enforcement, session invalidations, and password reset workflows." },
        { title: "Access Reviews", desc: "Automated quarterly access certifications for compliance standards." },
      ]}
    />
  );
}
