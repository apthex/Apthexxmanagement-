import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { LeadsClient } from "./leads-client";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requirePageAccess("leads.read", "/leads");
  return <LeadsClient />;
}
