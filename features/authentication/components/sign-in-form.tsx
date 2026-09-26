"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { signInAction } from "../actions";
import { signInInputSchema, type SignInInput } from "../schema";

export function SignInForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({ resolver: zodResolver(signInInputSchema) });

  async function onSubmit(values: SignInInput) {
    setServerError(null);
    // On success this redirects server-side and never returns.
    const result = await signInAction(values);
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
        error={errors.password?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            type="password"
            autoComplete="current-password"
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
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
