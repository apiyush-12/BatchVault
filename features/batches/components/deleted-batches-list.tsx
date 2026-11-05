"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { LocalDate } from "@/components/ui/local-date";

import { restoreBatchAction } from "../actions";
import type { DeletedBatch } from "../types";

/** The owner's batches scheduled for deletion, with restore (PRD #6). */
export function DeletedBatchesList({ batches }: { batches: DeletedBatch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function restore(batchId: string) {
    setError(null);
    startTransition(async () => {
      const result = await restoreBatchAction({ batchId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="deleted-batches-heading"
      className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong/70 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <Archive aria-hidden="true" className="size-4 text-foreground-muted" />
        <h2 id="deleted-batches-heading" className="text-heading-sm font-semibold">
          Scheduled for deletion
        </h2>
      </div>
      <ul className="flex flex-col gap-2">
        {batches.map((batch) => (
          <li
            key={batch.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body font-semibold text-foreground">{batch.name}</span>
              <span className="text-body-sm text-foreground-muted">
                {batch.restorable ? (
                  <>
                    Restore it until <LocalDate value={batch.restorableUntil} /> — after that it&rsquo;s
                    permanently deleted.
                  </>
                ) : (
                  "The restore window has passed, so this batch can't be restored."
                )}
              </span>
            </span>
            {batch.restorable && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => restore(batch.id)}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                Restore
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error !== null && <FormMessage tone="error">{error}</FormMessage>}
    </section>
  );
}
