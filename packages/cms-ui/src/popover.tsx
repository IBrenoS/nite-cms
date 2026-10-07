import type { ComponentPropsWithoutRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "./utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverPortal = PopoverPrimitive.Portal;
const PopoverClose = PopoverPrimitive.Close;

function PopoverPopup({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverPrimitive.Popup> & {
  sideOffset?: number;
}) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Positioner sideOffset={sideOffset}>
        <PopoverPrimitive.Popup
          data-slot="popover-popup"
          className={cn(
            "z-50 w-72 rounded-lg border border-border-subtle bg-surface p-4 text-text-primary shadow-popover outline-none transition-all [transition-duration:var(--motion-duration-normal)] [transition-timing-function:var(--motion-ease)] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPortal>
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverPortal,
  PopoverClose,
  PopoverPopup,
  PopoverPopup as PopoverContent,
};
