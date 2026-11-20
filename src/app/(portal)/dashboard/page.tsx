import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePageAccess("dashboard.view", "/dashboard");
  return <DashboardClient />;
}
