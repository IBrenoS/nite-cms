import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const alertVariants = cva(
  "relative w-full rounded-md border p-4 text-ui-md leading-relaxed",
  {
    variants: {
      variant: {
        info: "border-primary-border bg-primary-subtle text-text-primary [&>svg]:text-primary",
        success:
          "border-success-border bg-success-bg text-success [&>svg]:text-success",
        warning:
          "border-warning-border bg-warning-bg text-warning [&>svg]:text-warning",
        danger:
          "border-danger-border bg-danger-bg text-danger [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: ComponentProps<"h5">) {
  return (
    <h5
      data-slot="alert-title"
      className={cn(
        "mb-1 font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-ui-sm leading-relaxed text-inherit opacity-90",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
