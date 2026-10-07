import type { ComponentProps } from "react";

import { cn } from "./utils";

function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-ui-md font-semibold text-text-primary select-none",
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-ui-sm text-text-muted leading-snug", className)}
      {...props}
    />
  );
}

function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn(
        "text-ui-sm font-medium text-danger leading-snug",
        className,
      )}
      {...props}
    />
  );
}

export { Field, FieldLabel, FieldDescription, FieldError };
