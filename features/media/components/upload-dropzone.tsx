"use client";

import { type LucideIcon, RefreshCw, ShieldCheck } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The shared pick-a-file surface for photo and video uploads: a large,
 * tappable area that also accepts a dropped file on desktop, a big preview
 * once something is chosen, and the type/size guidance beside it.
 *
 * Purely presentational. Validation, the signed-URL upload and finalization
 * stay in the owning form — this component only hands over a `File`.
 */
export function UploadDropzone({
  icon: Icon,
  accept,
  inputLabel,
  hasFile,
  disabled,
  preview,
  guidance,
  onFile,
}: {
  icon: LucideIcon;
  accept: string;
  /** Accessible name of the hidden file input (e.g. "Photo"). */
  inputLabel: string;
  hasFile: boolean;
  disabled?: boolean;
  preview: ReactNode;
  guidance: ReactNode;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file !== undefined) onFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed bg-surface-sunken/60 transition-colors",
          dragging ? "border-primary bg-primary-soft/60" : "border-border-strong/70",
          hasFile && "border-solid border-border bg-surface-sunken",
        )}
      >
        {hasFile ? (
          <div className="relative aspect-[4/3] w-full">
            {preview}
            <div className="absolute right-3 bottom-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Choose a different one
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-56 w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:min-h-64"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon aria-hidden="true" className="size-7" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-body font-semibold text-foreground">
                Tap to choose from your device
              </span>
              <span className="hidden text-body-sm text-foreground-muted sm:block">
                or drag and drop it here
              </span>
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          aria-label={inputLabel}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) onFile(file);
            // Allow re-selecting the same file after an error.
            event.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5 text-caption text-foreground-muted">
        <p>{guidance}</p>
        <p className="inline-flex items-start gap-1.5">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success" />
          <span>
            Only your batch can see this. Location data is removed from JPEG photos before
            anyone else sees them; the picture itself is never altered.
          </span>
        </p>
      </div>
    </div>
  );
}
