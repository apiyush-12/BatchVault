import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * shadcn/ui-style primitive, vendored in-repo (rules.md §1.5).
 *
 * Focus treatment intentionally matches the global `:focus-visible` ring in
 * app/globals.css (design.md §27) rather than redefining its own.
 */
export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full rounded-md border border-border bg-surface px-3 text-body text-foreground placeholder:text-foreground-muted",
        "outline-none transition-colors focus-visible:border-focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
