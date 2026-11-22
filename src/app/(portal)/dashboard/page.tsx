import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageAccess } from "@/lib/auth/guards";
import { LiveWebClient } from "../liveweb/liveweb-client";

export const metadata: Metadata = { title: "Live Analytics · Apthex" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePageAccess("dashboard.view", "/dashboard");
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Loading analytics...</div>}>
      <LiveWebClient />
    </Suspense>
  );
}
