"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { markOnboardingCompleteAction, saveOwnProfileAction } from "../actions";
import { onboardingInputSchema, type OnboardingInput } from "../schema";
import { AvatarUploader } from "./avatar-uploader";

/**
 * Profile onboarding: display name, optional avatar, bio (phases.md Phase 1;
 * PRD §9.2) — a short, single mobile-friendly step (design.md §14).
 */
export function OnboardingForm({
  initialAvatarUrl,
}: {
  initialAvatarUrl: string | null;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingInput>({ resolver: zodResolver(onboardingInputSchema) });

  async function onSubmit(values: OnboardingInput) {
    setServerError(null);

    const saved = await saveOwnProfileAction(values);
    if (!saved.ok) {
      setServerError(saved.error);
      return;
    }

    // On success this redirects server-side and never returns.
    const completed = await markOnboardingCompleteAction();
    if (!completed.ok) {
      setServerError(completed.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <AvatarUploader initialAvatarUrl={initialAvatarUrl} />

      <FormField
        label="Display name"
        error={errors.displayName?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            autoComplete="name"
            aria-invalid={errors.displayName !== undefined}
            aria-describedby={describedBy}
            {...register("displayName")}
          />
        )}
      />

      <FormField
        label="Bio"
        hint="Optional. Up to 500 characters."
        error={errors.bio?.message}
        render={({ inputId, describedBy }) => (
          <Textarea
            id={inputId}
            aria-invalid={errors.bio !== undefined}
            aria-describedby={describedBy}
            {...register("bio")}
          />
        )}
      />

      {serverError !== null && (
        <p role="alert" className="text-body-sm font-medium text-danger">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
