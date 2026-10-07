import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-[loading=true]:cursor-wait data-[loading=true]:after:ms-2 data-[loading=true]:after:inline-block data-[loading=true]:after:size-1.5 data-[loading=true]:after:rounded-full data-[loading=true]:after:bg-current data-[loading=true]:after:content-[''] aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-bg [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-text-inverse hover:bg-primary-hover active:bg-primary-active border-transparent",
        secondary:
          "bg-surface text-text-primary border-border hover:bg-surface-hover hover:border-border-strong active:bg-surface-active",
        ghost:
          "bg-transparent text-text-primary border-transparent hover:bg-surface-hover active:bg-surface-active",
        danger:
          "bg-danger text-text-inverse hover:brightness-90 active:brightness-75 border-transparent",
        // Compatibilidade com variantes anteriores
        outline:
          "bg-surface text-text-primary border-border hover:bg-surface-hover hover:border-border-strong active:bg-surface-active",
        quiet:
          "bg-transparent text-text-secondary border-transparent hover:bg-surface-hover hover:text-text-primary active:bg-surface-active",
        spotlight:
          "bg-primary text-text-inverse hover:bg-primary-hover active:bg-primary-active border-transparent",
        link: "h-auto min-h-0 rounded-none bg-transparent px-0 py-0 text-primary underline-offset-4 shadow-none hover:underline active:translate-y-0",
      },
      size: {
        sm: "h-8 px-3 text-ui-sm leading-none",
        md: "h-9 px-3.5 text-ui-md leading-none",
        lg: "h-10 px-4 text-ui-md leading-none",
        icon: "size-9 p-0",
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
