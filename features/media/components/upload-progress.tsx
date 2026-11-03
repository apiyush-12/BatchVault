import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

type Step = { label: string; state: "done" | "active" | "todo" };

/**
 * Honest two-step progress for the upload moment (design.md §18): the
 * browser-to-Storage transfer, then the server-side save. The Storage
 * client gives no byte-level progress callback, so this shows real stage
 * transitions rather than a fabricated percentage.
 */
export function UploadProgress({ stage }: { stage: "uploading" | "finalizing" }) {
  const steps: Step[] = [
    { label: "Uploading", state: stage === "uploading" ? "active" : "done" },
    { label: "Saving to your batch", state: stage === "finalizing" ? "active" : "todo" },
  ];

  return (
    <ol
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-xl border border-border bg-surface-sunken/60 px-4 py-3"
    >
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-3">
          {index > 0 && <span aria-hidden="true" className="h-px w-6 bg-border-strong" />}
          <span className="flex items-center gap-2 text-body-sm">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full",
                step.state === "done" && "bg-success text-primary-foreground",
                step.state === "active" && "bg-primary text-primary-foreground",
                step.state === "todo" && "border border-border-strong text-foreground-muted",
              )}
            >
              {step.state === "done" ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : step.state === "active" ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <span className="text-[0.625rem] font-semibold">{index + 1}</span>
              )}
            </span>
            <span
              className={cn(
                step.state === "todo" ? "text-foreground-muted" : "font-medium text-foreground",
              )}
            >
              {step.label}
              {step.state === "active" ? "…" : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
