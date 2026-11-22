import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Clients · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requirePageAccess("clients.read", "/clients");
  return (
    <ComingSoon
      title="Client Management & Accounts"
      badge="Launching Q1 2026"
      description="Centralized institution and enterprise client registry, SLA tracking, active contract terms, and dedicated account managers."
      features={[
        { title: "Client Directory", desc: "Enterprise account profiles, contracts, point of contact details, and tier management." },
        { title: "SLA & Health Monitoring", desc: "Live service level agreement timers, incident escalations, and account satisfaction metrics." },
        { title: "Direct Contact Matrix", desc: "Secure directory of verified representatives with instant escalation routing." },
        { title: "Institutional Assets", desc: "Dedicated resource libraries and documentation vaults per organization." },
      ]}
    />
  );
}
