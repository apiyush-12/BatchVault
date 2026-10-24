"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { editMemoryAction } from "../actions";
import { editMemoryInputSchema, type EditMemoryInput } from "../schema";
import type { Memory } from "../types";

/**
 * Author edit (phases.md Phase 4B; PRD #7, resolved 2026-10-24: edit only
 * — there is no delete control here, anywhere, for anyone, in this phase).
 */
export function EditMemoryForm({ batchId, memory }: { batchId: string; memory: Memory }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditMemoryInput>({
    resolver: zodResolver(editMemoryInputSchema),
    defaultValues: {
      caption: memory.caption ?? undefined,
      eventName: memory.eventName ?? undefined,
      occurredOn: memory.occurredOn,
    },
  });

  async function onSubmit(values: EditMemoryInput) {
    setIsSaving(true);
    setError(null);

    const result = await editMemoryAction(memory.id, values);

    if (!result.ok) {
      setIsSaving(false);
      setError(result.error);
      return;
    }

    router.push(`/batches/${batchId}/memories`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormField
        label="Caption"
        hint="Optional. Up to 2000 characters."
        error={errors.caption?.message}
        render={({ inputId, describedBy }) => (
          <Textarea
            id={inputId}
            aria-invalid={errors.caption !== undefined}
            aria-describedby={describedBy}
            {...register("caption")}
          />
        )}
      />

      <FormField
        label="Event"
        hint="Optional."
        error={errors.eventName?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            aria-invalid={errors.eventName !== undefined}
            aria-describedby={describedBy}
            {...register("eventName")}
          />
        )}
      />

      <FormField
        label="Date"
        error={errors.occurredOn?.message}
        render={({ inputId, describedBy }) => (
          <Input
            id={inputId}
            type="date"
            aria-invalid={errors.occurredOn !== undefined}
            aria-describedby={describedBy}
            {...register("occurredOn")}
          />
        )}
      />

      {error !== null && (
        <p role="alert" className="text-body-sm font-medium text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isSaving} className="self-start">
        {isSaving && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {isSaving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
