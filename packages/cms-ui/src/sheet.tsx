import type { ComponentProps, ComponentPropsWithoutRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;
const SheetClose = DialogPrimitive.Close;

function SheetBackdrop({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-[rgb(23_26_31/0.45)] backdrop-blur-xs transition-opacity [transition-duration:var(--motion-duration-fast)] [transition-timing-function:var(--motion-ease)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

const sheetPopupVariants = cva(
  "fixed z-50 flex flex-col gap-4 bg-surface p-6 shadow-dialog outline-none transition-transform [transition-timing-function:var(--motion-ease)] [transition-duration:var(--motion-duration-normal)]",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-full max-w-md border-l border-border-subtle data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
        left: "inset-y-0 left-0 h-full w-full max-w-md border-r border-border-subtle data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
        bottom:
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t border-border-subtle data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

type SheetPopupProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Popup> &
  VariantProps<typeof sheetPopupVariants>;

function SheetPopup({
  className,
  side = "right",
  children,
  ...props
}: SheetPopupProps) {
  return (
    <SheetPortal>
      <SheetBackdrop />
      <DialogPrimitive.Popup
        data-slot="sheet-popup"
        className={cn(sheetPopupVariants({ side, className }))}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "text-heading-sm font-semibold text-text-primary leading-tight",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        "text-ui-md text-text-secondary leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetBackdrop,
  SheetPopup,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  // Alias conveniente:
  SheetPopup as SheetContent,
};
