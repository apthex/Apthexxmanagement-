"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line dark:border-white/10 bg-white dark:bg-[#14141A] p-0 shadow-float outline-none data-[state=open]:animate-dialog-in apt-scroll",
            widths[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line dark:border-white/[0.08] px-5 py-4">
            <div>
              <DialogPrimitive.Title className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink dark:text-white">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[12.5px] leading-5 text-zinc-500 dark:text-zinc-400">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close dialog" className="size-8">
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="px-5 py-5 text-ink dark:text-zinc-200">{children}</div>
          {footer ? <div className="flex items-center justify-end gap-2 border-t border-line dark:border-white/[0.08] bg-zinc-50/70 dark:bg-[#101015] px-5 py-3.5 rounded-b-2xl">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  confirmLabel = "Delete",
  onConfirm,
  loading,
  danger = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmWord: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  const [value, setValue] = React.useState("");
  React.useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} disabled={value !== confirmWord} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">{description}</div>
        <div>
          <p className="mb-1.5 text-[12px] text-zinc-600 dark:text-zinc-400">
            Type <strong className="font-semibold text-ink dark:text-white font-mono">{confirmWord}</strong> to confirm.
          </p>
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="flex h-9.5 w-full rounded-lg border border-line dark:border-white/10 bg-white dark:bg-[#16161D] px-3 text-[13px] text-ink dark:text-zinc-100 outline-none focus:border-red/60 focus:ring-2 focus:ring-red/20"
            aria-label={`Type ${confirmWord} to confirm`}
          />
        </div>
      </div>
    </Modal>
  );
}
