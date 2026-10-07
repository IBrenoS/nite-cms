import type { ReactNode } from "react";
import { CircleDashedIcon } from "lucide-react";

import { cn } from "./utils";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-start gap-2.5 rounded-lg border border-border-subtle bg-surface p-6 text-ui-md text-text-secondary",
        className,
      )}
    >
      <div className="text-text-muted" aria-hidden="true">
        {icon ?? <CircleDashedIcon className="size-6 text-primary" />}
      </div>
      <p className="font-heading text-ui-lg font-semibold text-text-primary">
        {title}
      </p>
      <p className="leading-relaxed text-text-secondary">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
