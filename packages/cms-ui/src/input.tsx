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
