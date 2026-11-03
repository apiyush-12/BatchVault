import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { fieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui-style primitive, vendored in-repo (rules.md §1.5). A plain
 * native `<select>` restyled to match `Input`/`Textarea` — introduced in
 * Phase 2 for the join-policy setting, which is a genuinely small, closed
 * choice that does not warrant a heavier combobox component. The chevron is
 * a Lucide glyph layered over the control so the native arrow can be hidden.
 */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className={cn("relative block w-full", className)}>
      <select
        data-slot="select"
        className={cn(fieldClassName, "h-11 appearance-none pr-10 pl-3.5")}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-foreground-muted"
      />
    </span>
  );
}
