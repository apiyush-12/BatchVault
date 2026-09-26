"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { updateBatchSettingsAction } from "../actions";
import { updateBatchSettingsInputSchema, type UpdateBatchSettingsInput } from "../schema";
import type { Batch } from "../types";

/** Admin+ batch settings (phases.md Phase 2). Page-level guard decides who reaches this. */
export function BatchSettingsForm({ batch }: { batch: Batch }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBatchSettingsInput>({
    resolver: zodResolver(updateBatchSettingsInputSchema),
    defaultValues: {
      batchId: batch.id,
      name: batch.name,
      institutionName: batch.institutionName,
      courseName: batch.courseName ?? "",
      departmentName: batch.departmentName ?? "",
      graduationYear: batch.graduationYear !== null ? String(batch.graduationYear) : "",
      section: batch.section ?? "",
      description: batch.description ?? "",
      joinPolicy: batch.joinPolicy,
    },
  });

  async function onSubmit(values: UpdateBatchSettingsInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateBatchSettingsAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <input type="hidden" {...register("batchId")} />

      <FormField
        label="Batch name"
        error={errors.name?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            aria-invalid={errors.name !== undefined}
            aria-describedby={describedBy}
            {...register("name")}
          />
        )}
      />

      <FormField
        label="Institution"
        error={errors.institutionName?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            aria-invalid={errors.institutionName !== undefined}
            aria-describedby={describedBy}
            {...register("institutionName")}
          />
        )}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          label="Course"
          hint="Optional."
          error={errors.courseName?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-invalid={errors.courseName !== undefined}
              aria-describedby={describedBy}
              {...register("courseName")}
            />
          )}
        />
        <FormField
          label="Department"
          hint="Optional."
          error={errors.departmentName?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-invalid={errors.departmentName !== undefined}
              aria-describedby={describedBy}
              {...register("departmentName")}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          label="Graduation year"
          hint="Optional."
          error={errors.graduationYear?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              aria-invalid={errors.graduationYear !== undefined}
              aria-describedby={describedBy}
              {...register("graduationYear")}
            />
          )}
        />
        <FormField
          label="Section"
          hint="Optional."
          error={errors.section?.message}
          render={({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-invalid={errors.section !== undefined}
              aria-describedby={describedBy}
              {...register("section")}
            />
          )}
        />
      </div>

      <FormField
        label="Description"
        hint="Optional. Up to 2000 characters."
        error={errors.description?.message}
        render={({ inputId, describedBy }) => (
          <Textarea
            id={inputId}
            aria-invalid={errors.description !== undefined}
            aria-describedby={describedBy}
            {...register("description")}
          />
        )}
      />

      <FormField
        label="Who can join"
        error={errors.joinPolicy?.message}
        render={({ inputId, describedBy }) => (
          <Select
            id={inputId}
            aria-invalid={errors.joinPolicy !== undefined}
            aria-describedby={describedBy}
            {...register("joinPolicy")}
          >
            <option value="invite_only_requires_approval">
              Invite link, then I approve each request
            </option>
            <option value="invite_only_auto_approve">
              Invite link, joins automatically
            </option>
          </Select>
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
