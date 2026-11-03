import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * shadcn/ui-style primitive, vendored in-repo (rules.md §1.5).
 *
 * Focus treatment intentionally matches the global `:focus-visible` ring in
 * app/globals.css (design.md §27) rather than redefining its own. The shared
 * `fieldClassName` keeps Input/Textarea/Select visually identical.
 */
export const fieldClassName = cn(
  "w-full rounded-md border border-border bg-surface text-body text-foreground",
  "placeholder:text-foreground-muted/70",
  "outline-none transition-[border-color,background-color] duration-150",
  "hover:border-border-strong focus-visible:border-focus-ring",
  "disabled:cursor-not-allowed disabled:opacity-55",
  "aria-invalid:border-danger",
);

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClassName, "h-11 px-3.5", className)}
      {...props}
    />
  );
}
