"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { deleteBatchAction } from "../actions";
import { deleteBatchInputSchema, type DeleteBatchInput } from "../schema";

/**
 * Owner-only batch deletion (PRD #6). Typed confirmation of the exact batch
 * name; `delete_batch` re-checks both ownership and the name itself.
 */
export function DeleteBatchForm({ batchId, batchName }: { batchId: string; batchName: string }) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DeleteBatchInput>({
    resolver: zodResolver(deleteBatchInputSchema),
    defaultValues: { batchId, confirmName: "" },
  });

  const confirmed = useWatch({ control, name: "confirmName" }) === batchName;

  async function onSubmit(values: DeleteBatchInput) {
    setServerError(null);
    const result = await deleteBatchAction(values);
    setServerError(result.error);
  }

  return (
    <section
      aria-labelledby="delete-batch-heading"
      className="flex flex-col gap-4 rounded-xl border border-danger/30 bg-danger-soft/30 p-5 sm:p-6"
    >
      <h2 id="delete-batch-heading" className="flex items-center gap-2 text-heading-sm font-semibold text-danger">
        <TriangleAlert aria-hidden="true" className="size-5" />
        Delete this batch
      </h2>
      <p className="text-body-sm text-foreground-muted">
        Everyone loses access right away. You can restore it from your home
        page for 30 days. After that, every memory, photo, video and comment in
        it is permanently deleted.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <input type="hidden" {...register("batchId")} />
        <FormField
          label={`Type “${batchName}” to confirm`}
          error={errors.confirmName?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              autoComplete="off"
              aria-invalid={errors.confirmName !== undefined}
              aria-describedby={describedBy}
              {...register("confirmName")}
            />
          )}
        />

        {serverError !== null && <FormMessage tone="error">{serverError}</FormMessage>}

        <Button type="submit" variant="danger" className="self-start" disabled={!confirmed || isSubmitting}>
          {isSubmitting ? "Deleting…" : "Delete batch"}
        </Button>
      </form>
    </section>
  );
}
