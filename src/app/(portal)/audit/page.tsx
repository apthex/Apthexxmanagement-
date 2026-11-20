import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { AuditClient } from "./audit-client";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePageAccess("audit.read", "/audit");
  return <AuditClient />;
}
