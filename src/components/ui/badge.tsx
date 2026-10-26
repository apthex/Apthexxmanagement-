import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-mono font-medium leading-4 tracking-[0.02em]",
  {
    variants: {
      tone: {
        neutral: "border-zinc-200/90 bg-zinc-100/70 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300",
        green: "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
        amber: "border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
        blue: "border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
        red: "border-red/20 bg-red-50/80 text-red dark:border-red/30 dark:bg-red/10 dark:text-red-400",
        dark: "border-zinc-800 bg-zinc-900 text-white dark:border-white/20 dark:bg-white/[0.12] dark:text-white",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  tone,
  className,
  children,
}: VariantProps<typeof badgeVariants> & { className?: string; children: React.ReactNode }) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}

const toneByValue: Record<string, VariantProps<typeof badgeVariants>["tone"]> = {
  active: "green",
  signed: "green",
  done: "green",
  won: "green",
  allowed: "green",
  in_progress: "blue",
  talking: "blue",
  sent: "blue",
  identified: "neutral",
  todo: "neutral",
  none: "neutral",
  on_hold: "amber",
  blocked: "amber",
  draft: "amber",
  expired: "amber",
  lost: "red",
  denied: "red",
  inactive: "red",
  closed: "neutral",
  owner: "dark",
  team: "blue",
  growth: "amber",
  viewer: "neutral",
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const labelText =
    label ??
    value
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  return <Badge tone={toneByValue[value] ?? "neutral"}>{labelText}</Badge>;
}
