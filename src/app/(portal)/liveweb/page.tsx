import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageAccess } from "@/lib/auth/guards";
import { LiveWebClient } from "./liveweb-client";

export const metadata: Metadata = { title: "LiveWeb · Apthex" };
export const dynamic = "force-dynamic";

export default async function LiveWebPage() {
  await requirePageAccess("liveweb.read", "/liveweb");
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Loading analytics...</div>}>
      <LiveWebClient />
    </Suspense>
  );
}
