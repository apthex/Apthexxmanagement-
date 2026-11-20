import * as React from "react";
import { cn } from "@/lib/cn";

export function TableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-white/85 dark:bg-[#131318] dark:border-white/[0.08] shadow-card backdrop-blur-sm", className)}>
      <div className="overflow-x-auto apt-scroll">{children}</div>
    </div>
  );
}

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn("w-full min-w-[720px] border-collapse text-left text-[13px]", className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-line bg-zinc-50/90 dark:bg-[#16161D] text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
      {children}
    </thead>
  );
}

export function TH({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("h-9.5 px-4 py-2.5 text-left font-semibold text-zinc-600 dark:text-zinc-300", className)} {...props}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.05]">{children}</tbody>;
}

export function TR({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(
        onClick ? "cursor-pointer transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] focus:bg-zinc-50/80 dark:focus:bg-white/[0.03] outline-none" : "hover:bg-zinc-50/40 dark:hover:bg-white/[0.015] transition-colors",
        className,
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => event.key === "Enter" && onClick() : undefined}
    >
      {children}
    </tr>
  );
}

export function TD({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3.5 align-middle text-zinc-800 dark:text-zinc-200", className)} {...props}>
      {children}
    </td>
  );
}
