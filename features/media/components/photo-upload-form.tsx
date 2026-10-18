"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { finalizeMemoryAction, requestPhotoUploadAction } from "../actions";
import { finalizeMemoryInputSchema, type FinalizeMemoryInput } from "../schema";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../types";

type Stage = "idle" | "uploading" | "finalizing" | "error" | "done";

/**
 * The upload flow (phases.md Phase 4A; architecture §8). Honest progress
 * and retry states (design.md §18) — a plain dedicated page rather than a
 * drawer/sheet overlay, since no such primitive is vendored in this repo
 * yet (the same simplification Phase 3B's confirmation controls recorded);
 * a future UI-polish pass can move this into a drawer without touching the
 * Server Actions.
 */
export function PhotoUploadForm({ batchId }: { batchId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Omit<FinalizeMemoryInput, "mediaAssetId">>({
    resolver: zodResolver(finalizeMemoryInputSchema.omit({ mediaAssetId: true })),
    defaultValues: { occurredOn: new Date().toISOString().slice(0, 10) },
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (chosen === undefined) {
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(chosen.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setStage("error");
      setError("Please choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (chosen.size > MAX_IMAGE_BYTES) {
      setStage("error");
      setError("That image is larger than 15 MB.");
      return;
    }
    setStage("idle");
    setError(null);
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  async function onSubmit(values: Omit<FinalizeMemoryInput, "mediaAssetId">) {
    if (file === null) {
      setError("Choose a photo first.");
      return;
    }

    setStage("uploading");
    setError(null);

    const requested = await requestPhotoUploadAction({
      batchId,
      declaredMimeType: file.type,
      declaredSize: file.size,
      originalFilename: file.name,
    });
    if (!requested.ok) {
      setStage("error");
      setError(requested.error);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from("batch-media")
      .uploadToSignedUrl(requested.data.path, requested.data.token, file);

    if (uploadError !== null) {
      setStage("error");
      setError("The upload didn't complete. Please try again.");
      return;
    }

    setStage("finalizing");

    const finalized = await finalizeMemoryAction({
      mediaAssetId: requested.data.mediaAssetId,
      ...values,
    });

    if (!finalized.ok) {
      setStage("error");
      setError(finalized.error);
      return;
    }

    setStage("done");
    router.push(`/batches/${batchId}/memories`);
  }

  const isBusy = stage === "uploading" || stage === "finalizing";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <div className="flex size-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-sunken">
          {previewUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a Storage URL (architecture §9).
            <img src={previewUrl} alt="Selected photo preview" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden="true" className="size-8 text-foreground-muted" />
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          {file === null ? "Choose photo" : "Choose a different photo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="sr-only"
          aria-label="Photo"
          onChange={handleFileChange}
        />
        <p className="text-caption text-foreground-muted">JPEG, PNG, WebP, or GIF, up to 15 MB.</p>
      </div>

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

      <Button type="submit" disabled={isBusy || file === null} className="self-start">
        {stage === "uploading" && (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Uploading…
          </>
        )}
        {stage === "finalizing" && (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Saving…
          </>
        )}
        {!isBusy && "Add to batch"}
      </Button>
    </form>
  );
}
