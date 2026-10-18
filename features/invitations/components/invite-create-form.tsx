"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { createInviteAction } from "../actions";
import { createInviteInputSchema, type CreateInviteInput } from "../schema";

/**
 * Invite creation (phases.md Phase 3A). Deliberately short: an optional use
 * cap and an optional expiry, then a shareable link (design.md §14).
 */
export function InviteCreateForm({
  batchId,
  onCreated,
}: {
  batchId: string;
  onCreated: (inviteUrl: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateInviteInput>({
    resolver: zodResolver(createInviteInputSchema),
    defaultValues: { batchId, maxUses: "", expiresInDays: "" },
  });

  async function onSubmit(values: CreateInviteInput) {
    setServerError(null);
    const result = await createInviteAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onCreated(result.data.inviteUrl);
    reset({ batchId, maxUses: "", expiresInDays: "" });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <input type="hidden" value={batchId} {...register("batchId")} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Use limit"
          hint="Optional. Leave blank for unlimited uses."
          error={errors.maxUses?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              aria-invalid={errors.maxUses !== undefined}
              aria-describedby={describedBy}
              {...register("maxUses")}
            />
          )}
        />
        <FormField
          label="Expires in (days)"
          hint="Optional. Leave blank for no expiry."
          error={errors.expiresInDays?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              aria-invalid={errors.expiresInDays !== undefined}
              aria-describedby={describedBy}
              {...register("expiresInDays")}
            />
          )}
        />
      </div>

      {serverError !== null && (
        <p role="alert" className="text-body-sm font-medium text-danger">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Creating…" : "Create invite link"}
      </Button>
    </form>
  );
}
