import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { LiveWebClient } from "./liveweb-client";

export const metadata: Metadata = { title: "LiveWeb" };
export const dynamic = "force-dynamic";

export default async function LiveWebPage() {
  await requirePageAccess("liveweb.read", "/liveweb");
  return <LiveWebClient />;
}
