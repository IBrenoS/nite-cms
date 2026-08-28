import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 disabled:saturate-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:saturate-50 data-[loading=true]:cursor-wait data-[loading=true]:after:ms-2 data-[loading=true]:after:inline-block data-[loading=true]:after:size-1.5 data-[loading=true]:after:rounded-full data-[loading=true]:after:bg-current data-[loading=true]:after:content-[''] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "nite-glass-action",
        spotlight:
          "relative overflow-hidden rounded-[1rem] nite-glass-action transition-all duration-200 focus-visible:ring-4 focus-visible:ring-white/30",
        outline:
          "border-nite-border-soft bg-transparent text-nite-text-primary hover:bg-nite-surface-subtle hover:text-nite-text-primary aria-expanded:bg-nite-surface-subtle aria-expanded:text-nite-text-primary",
        invisible:
          "h-auto min-h-0 w-fit rounded-none border-transparent bg-transparent !px-0 !py-0 text-nite-text-secondary shadow-none hover:text-nite-text-primary focus-visible:text-nite-text-primary focus-visible:ring-0 active:translate-y-0",
        quiet:
          "border-nite-border-soft bg-transparent text-nite-text-secondary hover:border-nite-border-hover hover:bg-nite-surface-subtle hover:text-nite-text-primary aria-expanded:border-nite-border-hover aria-expanded:bg-nite-surface-subtle aria-expanded:text-nite-text-primary",
        secondary:
          "border-nite-border-soft bg-nite-surface text-nite-text-primary hover:bg-nite-surface-focus aria-expanded:bg-nite-surface-focus aria-expanded:text-nite-text-primary",
        ghost:
          "bg-transparent text-nite-text-primary hover:bg-nite-surface-subtle hover:text-nite-text-primary aria-expanded:bg-nite-surface-subtle aria-expanded:text-nite-text-primary",
        link: "h-auto min-h-0 rounded-sm bg-transparent px-0 py-0 text-nite-brand-accent underline-offset-4 shadow-none hover:underline active:translate-y-0",
      },
      size: {
        md: "min-h-10 px-4 py-2",
        sm: "min-h-9 px-3 py-1.5 text-sm in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        lg: "min-h-11 px-5 py-2.5 text-base",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    loading?: boolean;
  };

function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
