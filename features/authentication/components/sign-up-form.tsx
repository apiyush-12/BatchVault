"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { signUpAction } from "../actions";
import { signUpInputSchema, type SignUpInput } from "../schema";

/**
 * React Hook Form + Zod resolver, the standard client form pattern
 * (rules.md §1.6, §2). Client validation is UX only — `signUpAction`
 * independently re-validates with the same schema server-side.
 */
export function SignUpForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpInputSchema) });

  async function onSubmit(values: SignUpInput) {
    setServerError(null);
    const result = await signUpAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (result.data.requiresVerification) {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div role="status" className="flex flex-col gap-2 text-body">
        <p className="font-medium text-foreground">Check your email</p>
        <p className="text-foreground-muted">
          We&rsquo;ve sent you a link to verify your account. Open it on this
          device to continue.
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
      <FormField
        label="Password"
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
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
