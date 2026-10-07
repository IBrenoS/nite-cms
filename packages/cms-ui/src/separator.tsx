import type { ComponentPropsWithoutRef } from "react";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "./utils";

type SeparatorProps = ComponentPropsWithoutRef<typeof SeparatorPrimitive> & {
  className?: string;
  orientation?: "horizontal" | "vertical";
};

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border-subtle",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
export type { SeparatorProps };
