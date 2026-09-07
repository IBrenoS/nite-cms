# Shared UI components

Framework: React 19 with Next.js 16 App Router. Styling uses Tailwind CSS 4, Base UI and class-variance-authority through the private `@nite/cms-ui` workspace.

## `packages/cms-ui/src/textarea.tsx`

Shared CMS UI primitive.

```tsx
import type { ComponentProps } from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "nite-form-field min-h-24 w-full rounded-xl border p-3 text-sm leading-5 outline-none transition duration-200",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
```

## `packages/cms-ui/src/button.tsx`

Shared CMS UI primitive.

```tsx
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
```

## `packages/cms-ui/src/chip.tsx`

Shared CMS UI primitive.

```tsx
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
```

## `packages/cms-ui/src/utils.ts`

Utility used by all UI primitives.

```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## `packages/cms-ui/src/empty-state.tsx`

Shared CMS UI primitive.

```tsx
import { CircleDashedIcon } from "lucide-react";

import { cn } from "./utils";

type EmptyStateProps = {
  title: string;
  description: string;
  className?: string;
};

function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "nite-panel flex flex-col gap-3 rounded-lg border border-border p-5 text-sm text-muted-foreground",
        className,
      )}
    >
      <CircleDashedIcon className="text-nite-brand-accent" aria-hidden="true" />
      <p className="font-heading text-base font-semibold text-foreground">
        {title}
      </p>
      <p className="leading-6">{description}</p>
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
```

## `packages/cms-ui/src/status-badge.tsx`

Shared CMS UI primitive.

```tsx
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const statusBadgeLabels = {
  draft: "Em estruturação",
  progress: "Em progresso",
  in_progress: "Em andamento",
  validated: "Validado",
  done: "Finalizado",
  warning: "Atenção",
  error: "Erro",
  archived: "Arquivado",
} as const;

type StatusBadgeStatus = keyof typeof statusBadgeLabels;
type StatusBadgeTone =
  | "brand"
  | "quiet"
  | "draft"
  | "progress"
  | "validated"
  | "done"
  | "warning"
  | "error";

const statusBadgeVariants = cva(
  "inline-flex min-h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs leading-none font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      size: {
        sm: "min-h-6 px-2 py-1 text-xs",
        md: "min-h-7 px-2.5 py-1 text-xs",
        lg: "min-h-7 px-3 py-1 text-sm leading-5",
      },
      variant: { soft: "", outline: "bg-transparent" },
    },
    defaultVariants: { size: "md", variant: "soft" },
  },
);

const statusBadgeToneClasses = {
  brand: {
    soft: "border-nite-brand-accent/35 bg-nite-brand-accent/10 text-nite-brand-accent",
    outline: "border-nite-brand-accent/55 text-nite-brand-accent",
  },
  quiet: {
    soft: "border-border bg-muted/40 text-muted-foreground",
    outline: "border-border text-muted-foreground",
  },
  draft: {
    soft: "border-status-draft/35 bg-status-draft/10 text-status-draft",
    outline: "border-status-draft/55 text-status-draft",
  },
  progress: {
    soft: "border-status-progress/35 bg-status-progress/10 text-status-progress",
    outline: "border-status-progress/55 text-status-progress",
  },
  validated: {
    soft: "border-status-validated/35 bg-status-validated/10 text-status-validated",
    outline: "border-status-validated/55 text-status-validated",
  },
  done: {
    soft: "border-status-done/35 bg-status-done/10 text-status-done",
    outline: "border-status-done/55 text-status-done",
  },
  warning: {
    soft: "border-status-warning/40 bg-status-warning/10 text-status-warning",
    outline: "border-status-warning/60 text-status-warning",
  },
  error: {
    soft: "border-status-error/40 bg-status-error/10 text-status-error",
    outline: "border-status-error/60 text-status-error",
  },
} satisfies Record<
  StatusBadgeTone,
  Record<
    NonNullable<VariantProps<typeof statusBadgeVariants>["variant"]>,
    string
  >
>;

const statusBadgeToneByStatus = {
  draft: "draft",
  progress: "progress",
  in_progress: "progress",
  validated: "validated",
  done: "done",
  warning: "warning",
  error: "error",
  archived: "draft",
} satisfies Record<StatusBadgeStatus, StatusBadgeTone>;

type StatusBadgeProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "children" | "color"
> &
  VariantProps<typeof statusBadgeVariants> & {
    status: StatusBadgeStatus;
    tone?: StatusBadgeTone;
    label?: ReactNode;
    icon?: ReactNode;
    showIndicator?: boolean;
  };

function StatusBadge({
  status,
  tone,
  label,
  icon,
  showIndicator = true,
  size = "md",
  variant = "soft",
  className,
  ...props
}: StatusBadgeProps) {
  const fallbackLabel = statusBadgeLabels[status];
  const visualTone = tone ?? statusBadgeToneByStatus[status];
  const visibleLabel =
    typeof label === "string" && label.trim().length === 0
      ? fallbackLabel
      : (label ?? fallbackLabel);

  return (
    <span
      data-slot="status-badge"
      data-status={status}
      data-variant={variant}
      className={cn(
        statusBadgeVariants({ size, variant }),
        statusBadgeToneClasses[visualTone][variant ?? "soft"],
        className,
      )}
      {...props}
    >
      {showIndicator ? (
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center justify-center [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          {icon ?? <span className="size-1.5 rounded-full bg-current" />}
        </span>
      ) : null}
      <span data-slot="status-badge-label" className="min-w-0">
        {visibleLabel}
      </span>
    </span>
  );
}

export { StatusBadge, statusBadgeLabels };
export type { StatusBadgeProps, StatusBadgeStatus, StatusBadgeTone };
```

## `packages/cms-ui/src/input.tsx`

Shared CMS UI primitive.

```tsx
import type { ComponentProps } from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "nite-form-field h-10 w-full rounded-xl border px-3 text-sm leading-5 outline-none transition duration-200",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
```

## `packages/cms-ui/src/card.tsx`

Shared CMS UI primitive.

```tsx
import type { ComponentProps, ComponentPropsWithoutRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const cardVariants = cva(
  "group/card flex flex-col gap-4 overflow-hidden rounded-xl border py-4 text-sm text-card-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
  {
    variants: {
      variant: {
        default: "border-nite-border-subtle bg-transparent",
        interactive:
          "border-nite-border-subtle bg-transparent hover:border-nite-border-hover hover:bg-nite-surface-subtle active:translate-y-px aria-disabled:pointer-events-none aria-disabled:opacity-60",
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
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4",
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
        "font-heading text-base leading-snug font-medium",
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
      className={cn("px-4", className)}
      {...props}
    />
  );
}

export { Card, cardVariants, CardHeader, CardTitle, CardContent };
```
