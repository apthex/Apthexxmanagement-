import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-red bg-red text-white shadow-sm hover:bg-red-dark active:scale-[0.98]",
        outline: "border-line bg-white/90 text-ink hover:bg-zinc-100/70 hover:text-ink dark:bg-[#16161D] dark:border-white/10 dark:text-zinc-200 dark:hover:bg-[#1F1F28] dark:hover:text-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-[0.98]",
        ghost: "border-transparent text-zinc-600 hover:bg-black/[0.04] hover:text-ink dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
        subtle: "border-transparent bg-zinc-100/80 text-ink hover:bg-zinc-200 dark:bg-white/[0.07] dark:text-zinc-200 dark:hover:bg-white/[0.12]",
        danger: "border-red bg-red text-white hover:bg-red-dark active:scale-[0.98]",
        link: "h-auto border-transparent p-0 text-[13px] text-zinc-600 underline underline-offset-4 hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-3.5",
        lg: "h-10 px-5 text-sm",
        icon: "h-9 w-9 px-0 shrink-0",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };
