import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ComingSoon } from "@/components/portal/coming-soon";

export const metadata: Metadata = { title: "Audit · Coming Soon" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePageAccess("audit.read", "/audit");
  return (
    <ComingSoon
      title="Security & Compliance Audit Trail"
      badge="Launching Q1 2026"
      description="Append-only cryptographic audit logs tracking all portal access, permission changes, data mutations, and exports."
      features={[
        { title: "Immutable Log Vault", desc: "Cryptographically verified, tamper-evident record of all security-sensitive operations." },
        { title: "Full Event Metadata", desc: "Detailed records containing actor ID, IP address, timestamp, diff payload, and user agent." },
        { title: "Compliance Filtering", desc: "Pre-built filters for SOC 2, ISO 27001, and GDPR auditor requests." },
        { title: "Real-Time Anomaly Alerts", desc: "Instant notifications on suspicious IP logins or privilege escalation attempts." },
      ]}
    />
  );
}
