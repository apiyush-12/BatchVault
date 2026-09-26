import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** shadcn/ui-style primitive, vendored in-repo (rules.md §1.5). */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-foreground placeholder:text-foreground-muted",
        "outline-none transition-colors focus-visible:border-focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
