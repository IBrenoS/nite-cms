import type { ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const chipVariants = cva(
  "inline-flex min-h-7 w-fit items-center rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        default:
          "border-nite-brand-accent/40 bg-nite-brand-accent/10 text-nite-brand-accent",
        quiet: "border-border bg-muted text-muted-foreground",
        metal:
          "border-nite-text-primary/40 bg-nite-text-primary/10 text-nite-text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ChipProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof chipVariants>;

function Chip({ className, variant, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ variant, className }))} {...props} />
  );
}

export { Chip, chipVariants };
