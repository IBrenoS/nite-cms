import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const chipVariants = cva(
  "inline-flex h-6 w-fit items-center rounded-full border px-2.5 font-mono text-ui-xs font-medium uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        default: "border-primary-border bg-primary-subtle text-primary",
        quiet: "border-border-subtle bg-surface-subtle text-text-secondary",
        metal: "border-border bg-surface text-text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ChipProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof chipVariants>;

function Chip({ className, variant, ...props }: ChipProps) {
  return (
    <span
      data-slot="chip"
      className={cn(chipVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Chip, chipVariants };
export type { ChipProps };
