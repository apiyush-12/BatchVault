import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * shadcn/ui-style primitive, vendored in-repo (rules.md §1.5). A plain
 * native `<select>` restyled to match `Input`/`Textarea` — introduced in
 * Phase 2 for the join-policy setting, which is a genuinely small, closed
 * choice that does not warrant a heavier combobox component.
 */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-11 w-full rounded-md border border-border bg-surface px-3 text-body text-foreground",
        "outline-none transition-colors focus-visible:border-focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
