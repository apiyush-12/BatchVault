"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createBatchAction } from "../actions";
import { createBatchInputSchema, type CreateBatchInput } from "../schema";

/**
 * Batch creation (phases.md Phase 2). One page, logically grouped rather
 * than a multi-step wizard — eight fields is still short enough for a single
 * mobile-friendly scroll (design.md §14).
 */
export function CreateBatchForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBatchInput>({
    resolver: zodResolver(createBatchInputSchema),
    defaultValues: { joinPolicy: "invite_only_requires_approval" },
  });

  async function onSubmit(values: CreateBatchInput) {
    setServerError(null);
    const result = await createBatchAction(values);
    // A successful call redirects server-side and never returns here.
    setServerError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormField
        label="Batch name"
        hint="What your batch will be called — e.g. “CS 2024, Section B”."
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
        hint="You can change this later in batch settings."
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

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-start">
        {isSubmitting ? "Creating…" : "Create batch"}
      </Button>
    </form>
  );
}
