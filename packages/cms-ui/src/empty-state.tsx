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
