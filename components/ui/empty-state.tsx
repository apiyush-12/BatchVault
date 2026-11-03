import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Warm, specific empty states (design.md §19): a quiet icon, a human line
 * about this moment, and the single next action — never a bare "No data".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border border-dashed border-border-strong/70 bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon !== undefined && (
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon aria-hidden="true" className="size-6" />
        </span>
      )}
      <div className="flex max-w-prose flex-col gap-1.5">
        <p className="text-heading-sm font-semibold text-foreground">{title}</p>
        {description !== undefined && (
          <p className="text-body-sm text-foreground-muted">{description}</p>
        )}
      </div>
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  );
}
