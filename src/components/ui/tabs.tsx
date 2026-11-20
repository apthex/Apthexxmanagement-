"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue} className={className}>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List className={cn("flex items-center gap-1 overflow-x-auto border-b border-line dark:border-white/[0.08] apt-scroll", className)}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="relative whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[12.5px] font-medium text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors data-[state=active]:border-red data-[state=active]:text-ink dark:data-[state=active]:text-white outline-none focus-visible:ring-2 focus-visible:ring-red/30"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Content value={value} className={cn("mt-5 outline-none", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
