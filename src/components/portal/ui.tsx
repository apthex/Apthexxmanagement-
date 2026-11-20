import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-red">
            // {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink dark:text-white sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line dark:border-white/[0.08] bg-white/80 dark:bg-[#131318] shadow-[0_1px_3px_rgba(23,23,27,0.03),0_1px_2px_rgba(23,23,27,0.02)] backdrop-blur-sm transition-all duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line dark:border-white/[0.08] px-5 py-4",
        className,
      )}
    >
      <div>
        <h2 className="font-display text-[16px] sm:text-[17px] font-semibold tracking-[-0.015em] text-ink dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  meta,
  icon: Icon,
  accent = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  accent?: "default" | "red" | "green" | "blue" | "amber";
  href?: React.ReactNode;
}) {
  const accents = {
    default: "bg-zinc-100 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300",
    red: "bg-red-50 text-red dark:bg-red/15 dark:text-red-400",
    green: "bg-emerald-50 text-ok dark:bg-emerald-500/15 dark:text-emerald-400",
    blue: "bg-sky-50 text-info dark:bg-sky-500/15 dark:text-sky-400",
    amber: "bg-amber-50 text-warn dark:bg-amber-500/15 dark:text-amber-400",
  } as const;

  return (
    <Card className="relative overflow-hidden p-4 sm:p-5 hover:border-black/15 dark:hover:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        {Icon ? (
          <span className={cn("flex size-7 items-center justify-center rounded-lg transition-transform", accents[accent])}>
            <Icon className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="metric-value mt-3 font-display text-[30px] sm:text-[34px] font-semibold leading-none text-ink dark:text-white">
        {value}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-white/[0.04] pt-2.5">
        {meta ? <div className="text-[12px] leading-4 text-zinc-500 dark:text-zinc-400">{meta}</div> : <span />}
        {href}
      </div>
    </Card>
  );
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[9.5px]",
    sm: "size-7 text-[10.5px]",
    md: "size-8 text-[11.5px]",
    lg: "size-10 text-[13.5px]",
  } as const;
  const palette = ["bg-zinc-800", "bg-[#272730]", "bg-[#353540]", "bg-zinc-700"];
  const tone = palette[(name.charCodeAt(0) || 0) % palette.length];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium tracking-[0.02em] text-white ring-2 ring-white/90 dark:ring-white/10",
        sizes[size],
        tone,
        className,
      )}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function PersonCell({
  name,
  subtitle,
  size = "sm",
}: {
  name: string;
  subtitle?: string | null;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink dark:text-zinc-100">{name}</span>
        {subtitle ? <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{subtitle}</span> : null}
      </span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-14")}>
      <span className="mb-3 flex size-10 items-center justify-center rounded-xl border border-line dark:border-white/10 bg-zinc-50/80 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <h3 className="text-[14px] font-semibold text-ink dark:text-zinc-200">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-zinc-500 dark:text-zinc-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red/15 text-red dark:text-red-400">
        <AlertCircle className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-[13.5px] font-semibold text-ink dark:text-white">Could not load this view</p>
        <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Try again
        </Button>
      ) : null}
    </Card>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-16 text-[12.5px] text-zinc-500 dark:text-zinc-400"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin text-red" aria-hidden /> {label}…
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <div key={col} className="skeleton h-5 rounded-md dark:bg-white/[0.06]" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function InlineAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    error: "border-red/25 bg-red-50/80 text-red dark:border-red/30 dark:bg-red/10 dark:text-red-300",
    success: "border-emerald-200 bg-emerald-50/80 text-ok dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    info: "border-sky-200 bg-sky-50/80 text-info dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
    warning: "border-amber-200 bg-amber-50/80 text-warn dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
  } as const;

  return (
    <div
      className={cn("rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-5", tones[tone], className)}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line dark:border-white/10 bg-white/90 dark:bg-[#15151B] pl-8.5 pr-3 text-[12.5px] text-ink dark:text-zinc-100 shadow-[0_1px_1px_rgba(23,23,27,0.02)] outline-none transition placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-red/50 focus:ring-2 focus:ring-red/10 dark:focus:border-red/60 dark:focus:ring-red/20"
        aria-label={placeholder}
      />
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line dark:border-white/[0.08] px-4 py-3">
      <p className="font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
        Page {page} of {pages} · {total.toLocaleString("en-IN")} events
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-3.5" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function FullWidth({ children }: { children: React.ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] leading-5 text-ink dark:text-zinc-200">{children || "—"}</dd>
    </div>
  );
}

export function Stars({
  value,
  onChange,
  readOnly,
}: {
  value: number | null | undefined;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value ? `${value} out of 5` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(value === star ? null : star)}
          className={cn(
            "text-[15px] leading-none transition",
            star <= (value ?? 0) ? "text-[#C58B18]" : "text-zinc-300 dark:text-zinc-600",
            !readOnly ? "hover:scale-110 cursor-pointer" : "cursor-default",
          )}
          aria-label={star <= (value ?? 0) ? `${star} star${star === 1 ? "" : "s"}` : `Rate ${star}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
