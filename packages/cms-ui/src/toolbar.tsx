import type { ComponentPropsWithoutRef } from "react";
import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";

import { cn } from "./utils";

function Toolbar({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-surface p-1 text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

function ToolbarGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ToolbarPrimitive.Group>) {
  return (
    <ToolbarPrimitive.Group
      data-slot="toolbar-group"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  );
}

function ToolbarButton({
  className,
  active,
  ...props
}: ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> & {
  active?: boolean;
}) {
  return (
    <ToolbarPrimitive.Button
      data-slot="toolbar-button"
      data-active={active ? "true" : undefined}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-sm px-2 text-ui-sm font-medium text-text-secondary transition-colors outline-none select-none hover:bg-surface-hover hover:text-text-primary focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle active:bg-surface-active disabled:pointer-events-none disabled:opacity-40 data-[active=true]:bg-surface-active data-[active=true]:font-semibold data-[active=true]:text-primary [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function ToolbarSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      className={cn("mx-1 h-5 w-px shrink-0 bg-border-subtle", className)}
      {...props}
    />
  );
}

export { Toolbar, ToolbarGroup, ToolbarButton, ToolbarSeparator };
