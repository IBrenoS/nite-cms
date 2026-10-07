import type { ComponentProps, ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const cardVariants = cva(
  "group/card flex flex-col gap-4 overflow-hidden rounded-lg border border-border-subtle bg-surface py-4 text-ui-md text-text-primary outline-none transition-colors focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
  {
    variants: {
      variant: {
        default: "bg-surface border-border-subtle",
        interactive:
          "bg-surface border-border-subtle hover:bg-surface-hover hover:border-border active:translate-y-px aria-disabled:pointer-events-none aria-disabled:opacity-60",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type CardSharedProps = VariantProps<typeof cardVariants> & {
  className?: string;
  disabled?: boolean;
};
type CardDivProps = CardSharedProps &
  Omit<
    ComponentPropsWithoutRef<"div">,
    "className" | "onClick" | "role" | "tabIndex"
  > & { as?: "div"; href?: never };
type CardAnchorProps = CardSharedProps &
  Omit<ComponentPropsWithoutRef<"a">, "className"> & {
    as: "a";
    href: string;
  };
type CardButtonProps = CardSharedProps &
  Omit<ComponentPropsWithoutRef<"button">, "className" | "disabled"> & {
    as: "button";
  };
type CardProps = CardDivProps | CardAnchorProps | CardButtonProps;

function Card({
  as = "div",
  className,
  variant = "default",
  disabled = false,
  ...props
}: CardProps) {
  const cardClassName = cn(cardVariants({ variant }), className);

  if (as === "a") {
    const { href, onClick, tabIndex, ...anchorProps } = props as Omit<
      CardAnchorProps,
      keyof CardSharedProps | "as"
    >;
    return (
      <a
        data-slot="card"
        data-variant={variant}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : tabIndex}
        className={cardClassName}
        href={disabled ? undefined : href}
        {...anchorProps}
        {...(onClick && !disabled ? { onClick } : {})}
      />
    );
  }

  if (as === "button") {
    const buttonProps = props as Omit<
      CardButtonProps,
      keyof CardSharedProps | "as"
    >;
    return (
      <button
        data-slot="card"
        data-variant={variant}
        type="button"
        disabled={disabled}
        className={cn("text-left", cardClassName)}
        {...buttonProps}
      />
    );
  }

  const divProps = props as Omit<CardDivProps, keyof CardSharedProps | "as">;
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cardClassName}
      {...divProps}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-4 has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-ui-lg leading-snug font-semibold text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 text-ui-md text-text-secondary", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-4 pt-2 pb-4", className)}
      {...props}
    />
  );
}

export { Card, cardVariants, CardHeader, CardTitle, CardContent, CardFooter };
