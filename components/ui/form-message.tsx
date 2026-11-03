import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Form-level feedback (as opposed to per-field errors, which `FormField`
 * handles). Errors are announced via `role="alert"`, success via
 * `role="status"`; neither relies on color alone (design.md §20–21, §25).
 */
export function FormMessage({
  tone,
  children,
  className,
}: {
  tone: "error" | "success";
  children: ReactNode;
  className?: string;
}) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-body-sm font-medium",
        isError
          ? "border-danger/30 bg-danger-soft text-danger"
          : "border-success/30 bg-success-soft text-success",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
