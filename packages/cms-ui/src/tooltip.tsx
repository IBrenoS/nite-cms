import type { ComponentPropsWithoutRef } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "./utils";

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipPortal = TooltipPrimitive.Portal;

function TooltipPopup({
  className,
  sideOffset = 4,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> & {
  sideOffset?: number;
}) {
  return (
    <TooltipPortal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-popup"
          className={cn(
            "z-50 overflow-hidden rounded-sm border border-border-subtle bg-surface px-2.5 py-1 text-ui-xs font-medium text-text-primary shadow-popover transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPortal>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipPortal,
  TooltipPopup,
  TooltipPopup as TooltipContent,
};
