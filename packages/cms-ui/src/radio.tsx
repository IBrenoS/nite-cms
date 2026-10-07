import type { ComponentPropsWithoutRef } from "react";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";

import { cn } from "./utils";

type RadioProps = ComponentPropsWithoutRef<typeof RadioPrimitive.Root>;

function Radio({ className, ...props }: RadioProps) {
  return (
    <RadioPrimitive.Root
      data-slot="radio"
      className={cn(
        "peer size-4.5 shrink-0 rounded-full border border-border bg-surface transition-colors outline-none select-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:text-primary",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-indicator"
        className="flex size-full items-center justify-center"
      >
        <span className="size-2 rounded-full bg-primary" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { Radio };
export type { RadioProps };
