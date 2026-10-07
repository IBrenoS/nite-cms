import type { ComponentPropsWithoutRef } from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "./utils";

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md bg-surface-subtle p-1 text-text-muted",
        className,
      )}
      {...props}
    />
  );
}

function TabsTab({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "inline-flex items-center justify-center rounded-sm px-3 py-1 text-ui-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-surface data-[selected]:font-semibold data-[selected]:text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn(
        "mt-2 outline-none focus-visible:ring-3 focus-visible:ring-primary-subtle",
        className,
      )}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTab,
  TabsPanel,
  // Aliases populares:
  TabsTab as TabsTrigger,
  TabsPanel as TabsContent,
};
