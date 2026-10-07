import type { ComponentProps } from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-10 w-full rounded-md border border-border bg-surface px-3 text-ui-md leading-5 text-text-primary placeholder:text-text-muted transition-colors outline-none focus:border-primary focus:ring-3 focus:ring-primary-subtle disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-disabled aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-bg",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
