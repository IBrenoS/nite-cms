import type { ComponentProps } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "./utils";

function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-border bg-surface pr-8 pl-3 text-ui-md leading-5 text-text-primary transition-colors outline-none focus:border-primary focus:ring-3 focus:ring-primary-subtle disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-disabled aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-bg",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}

export { Select };
