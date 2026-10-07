import type { ComponentPropsWithoutRef } from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "./utils";

const DropdownMenu = MenuPrimitive.Root;
const DropdownMenuTrigger = MenuPrimitive.Trigger;
const DropdownMenuPortal = MenuPrimitive.Portal;
const DropdownMenuGroup = MenuPrimitive.Group;

function DropdownMenuPopup({
  className,
  sideOffset = 4,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof MenuPrimitive.Popup> & {
  sideOffset?: number;
}) {
  return (
    <DropdownMenuPortal>
      <MenuPrimitive.Positioner sideOffset={sideOffset}>
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-popup"
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border-subtle bg-surface p-1 text-text-primary shadow-popover outline-none transition-all [transition-duration:var(--motion-duration-normal)] [transition-timing-function:var(--motion-ease)] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-ui-sm font-medium text-text-primary outline-none select-none transition-colors hover:bg-surface-hover hover:text-text-primary focus:bg-surface-hover focus:text-text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border-subtle", className)}
      {...props}
    />
  );
}

function DropdownMenuGroupLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof MenuPrimitive.GroupLabel>) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-group-label"
      className={cn(
        "px-2 py-1 text-ui-xs font-semibold text-text-muted select-none",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuGroup,
  DropdownMenuPopup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroupLabel,
  // Aliases populares:
  DropdownMenuPopup as DropdownMenuContent,
};
