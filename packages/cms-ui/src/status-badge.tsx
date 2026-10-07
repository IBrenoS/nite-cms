import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const statusBadgeLabels = {
  draft: "Em estruturação",
  progress: "Em progresso",
  in_progress: "Em andamento",
  scheduled: "Agendada",
  validated: "Validado",
  done: "Finalizado",
  published: "Publicada",
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
  "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-sm border px-2 text-ui-xs font-semibold leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      size: {
        sm: "h-5 px-1.5 text-ui-xs",
        md: "h-6 px-2 text-ui-xs",
        lg: "h-7 px-2.5 text-ui-sm",
      },
      variant: {
        soft: "",
        outline: "bg-transparent",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "soft",
    },
  },
);

const statusBadgeToneClasses = {
  brand: {
    soft: "border-primary-border bg-primary-subtle text-primary",
    outline: "border-primary text-primary",
  },
  quiet: {
    soft: "border-border-subtle bg-surface-subtle text-text-secondary",
    outline: "border-border text-text-secondary",
  },
  draft: {
    soft: "border-border-subtle bg-surface-subtle text-text-secondary",
    outline: "border-border text-text-secondary",
  },
  progress: {
    soft: "border-primary-border bg-primary-subtle text-primary",
    outline: "border-primary text-primary",
  },
  validated: {
    soft: "border-success-border bg-success-bg text-success",
    outline: "border-success-border text-success",
  },
  done: {
    soft: "border-success-border bg-success-bg text-success",
    outline: "border-success-border text-success",
  },
  warning: {
    soft: "border-warning-border bg-warning-bg text-warning",
    outline: "border-warning-border text-warning",
  },
  error: {
    soft: "border-danger-border bg-danger-bg text-danger",
    outline: "border-danger-border text-danger",
  },
} satisfies Record<
  StatusBadgeTone,
  Record<
    NonNullable<VariantProps<typeof statusBadgeVariants>["variant"]>,
    string
  >
>;

const statusBadgeToneByStatus: Record<StatusBadgeStatus, StatusBadgeTone> = {
  draft: "draft",
  progress: "progress",
  in_progress: "progress",
  scheduled: "progress",
  validated: "validated",
  done: "done",
  published: "done",
  warning: "warning",
  error: "error",
  archived: "draft",
};

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
  showIndicator = false,
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
          className="inline-flex shrink-0 items-center justify-center [&_svg]:size-3 [&_svg]:shrink-0"
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

export { StatusBadge, statusBadgeLabels, statusBadgeVariants };
export type { StatusBadgeProps, StatusBadgeStatus, StatusBadgeTone };
