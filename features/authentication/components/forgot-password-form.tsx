"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { requestPasswordResetAction } from "../actions";
import {
  requestPasswordResetInputSchema,
  type RequestPasswordResetInput,
} from "../schema";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetInputSchema),
  });

  async function onSubmit(values: RequestPasswordResetInput) {
    setServerError(null);
    // The success shape is identical whether or not the address is
    // registered (security.md §3); the only error is a rate limit.
    const result = await requestPasswordResetAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-2 text-body">
        <p className="font-medium text-foreground">Check your email</p>
        <p className="text-foreground-muted">
          If an account exists for that email, we&rsquo;ve sent a link to reset
          the password. It can take a minute to arrive, so check your spam
          folder too. Open the link on this device.
        </p>
      </div>
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
      {serverError !== null && <FormMessage tone="error">{serverError}</FormMessage>}
      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
