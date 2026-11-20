import type { Metadata } from "next";
import { requirePageAccess } from "@/lib/auth/guards";
import { TasksClient } from "./tasks-client";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  await requirePageAccess("tasks.read", "/tasks");
  return <TasksClient />;
}
