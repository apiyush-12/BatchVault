"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { updatePasswordAction } from "../actions";
import {
  updatePasswordInputSchema,
  type UpdatePasswordInput,
} from "../schema";

export function UpdatePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordInputSchema),
  });

  async function onSubmit(values: UpdatePasswordInput) {
    setServerError(null);
    // On success this redirects server-side and never returns.
    const result = await updatePasswordAction(values);
    if (!result.ok) {
      setServerError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <FormField
        label="New password"
        hint="At least 8 characters."
        error={errors.password?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password !== undefined}
            aria-describedby={describedBy}
            {...register("password")}
          />
        )}
      />
      {serverError !== null && (
        <p role="alert" className="text-body-sm font-medium text-danger">
          {serverError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
