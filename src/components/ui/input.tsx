import * as React from "react";
import { cn } from "@/lib/cn";

const base =
  "flex h-9.5 w-full rounded-lg border border-line bg-white/90 px-3 py-2 text-[13px] text-ink shadow-[0_1px_1px_rgba(23,23,27,0.02)] outline-none transition placeholder:text-zinc-400 focus:border-red/50 focus:ring-2 focus:ring-red/10 dark:bg-[#15151B] dark:border-white/10 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-red/60 dark:focus:ring-red/20 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 disabled:dark:bg-white/[0.03] disabled:dark:text-zinc-600";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, "h-auto min-h-24 resize-y py-2", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(base, "cursor-pointer appearance-none pr-8 bg-[right_0.75rem_center] bg-no-repeat", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required ? <span className="text-red font-bold" aria-hidden>*</span> : null}
      </label>
      {children}
      {error ? <p className="text-[11.5px] text-red">{error}</p> : hint ? <p className="text-[11.5px] leading-4 text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn("size-4 rounded border-line dark:border-white/20 bg-white dark:bg-[#15151B] text-red accent-red focus:ring-red/30 cursor-pointer", className)}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";
