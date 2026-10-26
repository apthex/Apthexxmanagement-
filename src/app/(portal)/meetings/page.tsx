import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { MeetingsClient } from "./meetings-client";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  await requirePageAccess("meetings.read", "/meetings");
  return <MeetingsClient />;
}
