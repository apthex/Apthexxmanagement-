import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { LiveWebClient } from "../liveweb/liveweb-client";

export const metadata: Metadata = { title: "Live Analytics · Apthex Operations" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePageAccess("dashboard.view", "/dashboard");
  return <LiveWebClient />;
}
