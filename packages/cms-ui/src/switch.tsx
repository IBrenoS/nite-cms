import type { ComponentPropsWithoutRef } from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "./utils";

type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-border transition-colors outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-surface transition-transform data-[checked]:translate-x-4 data-[unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
export type { SwitchProps };
