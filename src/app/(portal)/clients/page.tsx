import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ClientsClient } from "./clients-client";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requirePageAccess("clients.read", "/clients");
  return <ClientsClient />;
}
