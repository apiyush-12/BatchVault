"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { deleteAccountAction } from "../actions";
import { deleteAccountInputSchema, type DeleteAccountInput } from "../schema";

/**
 * Permanent account deletion with the honest what-happens wording
 * (security.md R4). `deleteAccountAction` re-checks the typed `DELETE`.
 */
export function DeleteAccountForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountInputSchema),
    defaultValues: { confirm: "" as DeleteAccountInput["confirm"] },
  });

  const confirmed = useWatch({ control, name: "confirm" }) === "DELETE";

  async function onSubmit(values: DeleteAccountInput) {
    setServerError(null);
    const result = await deleteAccountAction(values);
    if (!result.ok) {
      setServerError(result.error);
    }
  }

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="flex flex-col gap-4 rounded-lg border border-danger/40 p-5"
    >
      <h2 id="delete-account-heading" className="text-heading-sm font-semibold">
        Delete your account
      </h2>
      <div className="flex flex-col gap-2 text-body-sm text-foreground-muted">
        <p>
          Your profile, photo, batch memberships and reactions are deleted
          permanently.
        </p>
        <p>
          Photos, videos and comments you shared stay in your batches, shown as
          from a &ldquo;Former member&rdquo;, so your batch&rsquo;s archive
          stays whole. If you want something removed, ask a batch moderator
          before you delete your account.
        </p>
        <p>If you own a batch, transfer it or delete it first. This can&rsquo;t be undone.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField
          label="Type DELETE to confirm"
          error={errors.confirm?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              autoComplete="off"
              aria-invalid={errors.confirm !== undefined}
              aria-describedby={describedBy}
              {...register("confirm")}
            />
          )}
        />

        {serverError !== null && (
          <p role="alert" className="text-body-sm font-medium text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" variant="danger" disabled={!confirmed || isSubmitting}>
          {isSubmitting ? "Deleting…" : "Delete account"}
        </Button>
      </form>
    </section>
  );
}
