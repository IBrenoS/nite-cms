import type { ComponentProps } from "react";

import { cn } from "./utils";

type SpinnerProps = ComponentProps<"svg"> & {
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
};

function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <svg
      data-slot="spinner"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("animate-spin text-current", sizeClasses[size], className)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export { Spinner };
export type { SpinnerProps };
