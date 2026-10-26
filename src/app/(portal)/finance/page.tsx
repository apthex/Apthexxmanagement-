import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { FinanceClient } from "./finance-client";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requirePageAccess("finance.read", "/finance");
  return <FinanceClient />;
}
