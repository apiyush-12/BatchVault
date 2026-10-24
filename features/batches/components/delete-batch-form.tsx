"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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
      className="flex flex-col gap-4 rounded-lg border border-danger/40 p-5"
    >
      <h2 id="delete-batch-heading" className="text-heading-sm font-semibold">
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

        {serverError !== null && (
          <p role="alert" className="text-body-sm font-medium text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" variant="danger" disabled={!confirmed || isSubmitting}>
          {isSubmitting ? "Deleting…" : "Delete batch"}
        </Button>
      </form>
    </section>
  );
}
