import { useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

/**
 * Wires a label, control and error message together with real `id` /
 * `aria-describedby` / `aria-invalid` associations — form errors are
 * associated with their field programmatically, never by color alone
 * (design.md §25).
 *
 * `render` receives the ids to attach to the actual input/textarea, keeping
 * this generic across control types without a heavier form-context library.
 */
export function FormField({
  label,
  error,
  hint,
  className,
  render,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  render: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter((value): value is string => value !== null)
      .join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      {render({ inputId, describedBy })}
      {hint !== undefined && (
        <p id={hintId} className="text-caption text-foreground-muted">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
