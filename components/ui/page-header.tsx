import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The shared page title block: an optional eyebrow (back link or context),
 * one h1, a short description, and right-aligned actions. Pages compose it
 * instead of hand-rolling header markup.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = "lg",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** `md` for section pages inside a batch, where the batch name already carries the weight. */
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {eyebrow}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1
            className={cn(
              "font-display text-foreground",
              size === "lg" ? "text-heading-lg sm:text-display-sm" : "text-heading-md",
            )}
          >
            {title}
          </h1>
          {description !== undefined && (
            <p className="max-w-prose text-body-sm text-foreground-muted sm:text-body">
              {description}
            </p>
          )}
        </div>
        {actions !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
