import type { ComponentProps } from "react";

import { cn } from "./utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-surface-subtle", className)}
      {...props}
    />
  );
}

export { Skeleton };
