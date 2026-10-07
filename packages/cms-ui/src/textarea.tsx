import type { ComponentProps } from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-surface p-3 text-ui-md leading-relaxed text-text-primary placeholder:text-text-muted transition-colors outline-none focus:border-primary focus:ring-3 focus:ring-primary-subtle disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-disabled aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-bg",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
