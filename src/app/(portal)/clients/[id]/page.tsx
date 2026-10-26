import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { ClientDetailClient } from "./client-detail-client";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("clients.read", "/clients/[id]");
  const { id } = await params;
  return <ClientDetailClient clientId={id} />;
}
