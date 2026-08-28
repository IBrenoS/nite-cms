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
