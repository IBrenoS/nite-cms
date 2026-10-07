import type { ComponentPropsWithRef } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const iconButtonVariants = cva(
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-transparent font-medium transition-colors outline-none select-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        ghost:
          "bg-transparent text-text-primary hover:bg-surface-hover active:bg-surface-active",
        secondary:
          "bg-surface text-text-primary border-border hover:bg-surface-hover hover:border-border-strong active:bg-surface-active",
        primary:
          "bg-primary text-text-inverse hover:bg-primary-hover active:bg-primary-active",
        danger:
          "bg-transparent text-danger hover:bg-danger-bg hover:border-danger-border active:brightness-95",
      },
      size: {
        sm: "size-8 [&_svg]:size-3.5",
        md: "size-9 [&_svg]:size-4",
        lg: "size-10 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

type IconButtonProps = Omit<
  ComponentPropsWithRef<typeof ButtonPrimitive>,
  "className"
> &
  VariantProps<typeof iconButtonVariants> & {
    "aria-label": string;
    className?: string;
  };

function IconButton({
  ref,
  className,
  variant = "ghost",
  size = "md",
  "aria-label": ariaLabel,
  ...props
}: IconButtonProps) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="icon-button"
      aria-label={ariaLabel}
      className={cn(iconButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
export type { IconButtonProps };
