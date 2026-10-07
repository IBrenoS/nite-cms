import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-sm border px-2 text-ui-xs font-semibold leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-border-subtle bg-surface-subtle text-text-secondary",
        primary: "border-primary-border bg-primary-subtle text-primary",
        success: "border-success-border bg-success-bg text-success",
        warning: "border-warning-border bg-warning-bg text-warning",
        danger: "border-danger-border bg-danger-bg text-danger",
        outline: "border-border bg-transparent text-text-primary",
      },
      size: {
        sm: "h-5 px-1.5 text-ui-xs",
        md: "h-6 px-2 text-ui-xs",
        lg: "h-7 px-2.5 text-ui-sm",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  },
);

type BadgeProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
