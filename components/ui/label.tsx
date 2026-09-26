import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** shadcn/ui-style primitive, vendored in-repo (rules.md §1.5). */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-body-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}
