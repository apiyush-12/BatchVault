"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { updateProfileAction } from "../actions";
import { updateProfileInputSchema, type UpdateProfileInput } from "../schema";
import { AvatarUploader } from "./avatar-uploader";

/** Basic account settings (phases.md Phase 1): edit own display name/bio/avatar. */
export function ProfileSettingsForm({
  initialDisplayName,
  initialBio,
  initialAvatarUrl,
}: {
  initialDisplayName: string;
  initialBio: string | null;
  initialAvatarUrl: string | null;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileInputSchema),
    defaultValues: {
      displayName: initialDisplayName,
      bio: initialBio ?? "",
    },
  });

  async function onSubmit(values: UpdateProfileInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateProfileAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
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
      {saved && (
        <p role="status" className="text-body-sm font-medium text-success">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-start">
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
