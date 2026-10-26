import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/permissions";

export default async function PortalNotFound() {
  const session = await requirePageSession();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl border border-line dark:border-white/10 bg-white dark:bg-[#16161D] text-zinc-400 dark:text-zinc-500 shadow-card">
        <LockKeyhole className="size-5" aria-hidden />
      </span>
      <p className="text-[10.5px] font-mono font-semibold uppercase tracking-[0.14em] text-red">Not found</p>
      <h1 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.03em] text-ink dark:text-zinc-100">This page is not available to you.</h1>
      <p className="mt-2 max-w-md text-[12.5px] leading-5 text-zinc-500 dark:text-zinc-400">
        It may not exist, or your role may not include access. Denied attempts are recorded in the audit trail.
      </p>
      <Link
        href={landingPath(session.member.accessLevel)}
        className="mt-5 inline-flex h-9 items-center rounded-md bg-ink dark:bg-white px-4 text-[12.5px] font-medium text-white dark:text-zinc-900 transition hover:bg-zinc-800 dark:hover:bg-zinc-100"
      >
        Return to your workspace
      </Link>
    </div>
  );
}
