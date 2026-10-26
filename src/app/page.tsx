import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requirePageSession();
  redirect(landingPath(session.member.accessLevel));
}
