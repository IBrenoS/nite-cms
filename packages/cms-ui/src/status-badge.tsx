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
