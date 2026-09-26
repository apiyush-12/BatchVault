"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { requestPasswordResetAction } from "../actions";
import {
  requestPasswordResetInputSchema,
  type RequestPasswordResetInput,
} from "../schema";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetInputSchema),
  });

  async function onSubmit(values: RequestPasswordResetInput) {
    // Always the same success shape, whether or not the address is
    // registered (security.md §3) — there is no error branch to show here.
    await requestPasswordResetAction(values);
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="text-body text-foreground-muted">
        If an account exists for that email, we&rsquo;ve sent a link to reset
        the password.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      <FormField
        label="Email"
        error={errors.email?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            type="email"
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            aria-describedby={describedBy}
            {...register("email")}
          />
        )}
      />
      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
