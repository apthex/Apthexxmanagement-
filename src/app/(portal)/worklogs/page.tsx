import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { WorkLogsClient } from "./worklogs-client";

export const metadata: Metadata = { title: "Work Logs" };
export const dynamic = "force-dynamic";

export default async function WorkLogsPage() {
  await requirePageAccess("worklogs.write_own", "/worklogs");
  return <WorkLogsClient />;
}
