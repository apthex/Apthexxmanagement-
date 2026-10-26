import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { MembersClient } from "./members-client";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await requirePageAccess("members.read", "/members");
  return <MembersClient />;
}
