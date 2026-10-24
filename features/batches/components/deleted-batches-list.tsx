"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { restoreBatchAction } from "../actions";
import type { DeletedBatch } from "../types";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

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
    <section aria-labelledby="deleted-batches-heading" className="flex flex-col gap-3">
      <h2 id="deleted-batches-heading" className="text-heading-sm font-semibold">
        Scheduled for deletion
      </h2>
      <ul className="flex flex-col gap-3">
        {batches.map((batch) => (
          <li
            key={batch.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4"
          >
            <span className="flex flex-col gap-1">
              <span className="text-body font-semibold text-foreground">{batch.name}</span>
              <span className="text-body-sm text-foreground-muted">
                {batch.restorable
                  ? `Permanently deleted after ${dateFormat.format(new Date(batch.restorableUntil))}`
                  : "Can't be restored"}
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
                Restore
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error !== null && (
        <p role="alert" className="text-body-sm font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
