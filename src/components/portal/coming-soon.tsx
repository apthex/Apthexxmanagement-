"use client";

import Link from "next/link";
import { Activity, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/portal/ui";

interface ComingSoonProps {
  title: string;
  badge?: string;
  description: string;
  features: { title: string; desc: string }[];
}

export function ComingSoon({
  title,
  badge = "Launching Q1 2026",
  description,
  features,
}: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-gradient-to-b from-white to-zinc-50 dark:from-[#14141a] dark:to-[#0c0c0e] p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-red/20 bg-red/[0.08] px-3 py-1 text-xs font-mono font-medium text-red">
              <span className="size-1.5 rounded-full bg-red animate-pulse" />
              <span>{badge}</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink dark:text-white sm:text-3xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-red px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/40 sm:self-center"
          >
            <Activity className="size-4" />
            <span>Open Live Analytics</span>
          </Link>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="space-y-3">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-500">
          // Planned Module Capabilities
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feat, idx) => (
            <Card key={idx} className="p-4 border-zinc-200 dark:border-white/10 bg-white dark:bg-[#14141a]">
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/5 font-mono text-xs font-bold text-red">
                  0{idx + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">{feat.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{feat.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Compliance / Security Note */}
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] p-4 text-xs text-zinc-500 dark:text-zinc-400">
        <ShieldCheck className="size-5 shrink-0 text-zinc-400" />
        <span>
          Apthex operations modules adhere to SOC 2 Type II audit logging and role-based access control. All internal mutations will be immutably recorded upon general availability.
        </span>
      </div>
    </div>
  );
}
