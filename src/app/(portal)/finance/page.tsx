import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Finance · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requirePageAccess("finance.read", "/finance");
  return (
    <ComingSoon
      title="Financial Operations & Invoicing"
      badge="Launching Q1 2026"
      description="Contract revenue tracking, institutional invoice generation, payment reconciliations, and expense accounting."
      features={[
        { title: "Invoice Automation", desc: "GST-compliant recurring and milestone invoices generated directly for institutes." },
        { title: "Revenue Recognition", desc: "Monthly recurring revenue (MRR), deferred revenue schedules, and cash flow projections." },
        { title: "Payment Gateways", desc: "Integrated payment tracking via NEFT, RTGS, and automated reconciliation." },
        { title: "Audit-Ready Ledgers", desc: "Exportable double-entry financial summaries prepared for statutory audits." },
      ]}
    />
  );
}
