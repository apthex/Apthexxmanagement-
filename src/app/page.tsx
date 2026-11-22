import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/permissions";
import { ensureDbReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureDbReady();
  const session = await requirePageSession();
  redirect(landingPath(session.member.accessLevel));
}
