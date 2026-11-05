"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { todayDateInputValue } from "@/lib/format/date";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { finalizeMemoryAction, requestPhotoUploadAction } from "../actions";
import { finalizeMemoryInputSchema, type FinalizeMemoryInput } from "../schema";
import {
  ALLOWED_IMAGE_TYPES,
  HEIC_GUIDANCE_MESSAGE,
  isLikelyHeic,
  MAX_IMAGE_BYTES,
} from "../types";
import { UploadDropzone } from "./upload-dropzone";
import { UploadProgress } from "./upload-progress";

type Stage = "idle" | "uploading" | "finalizing" | "error" | "done";

/**
 * The upload flow (phases.md Phase 4A; architecture §8). Honest progress
 * and retry states (design.md §18). The two-phase pipeline — server-issued
 * signed path, direct browser upload, server-side finalize — is unchanged;
 * this pass only reshaped the surface around it.
 */
export function PhotoUploadForm({ batchId }: { batchId: string }) {
  const router = useRouter();
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
    defaultValues: { occurredOn: todayDateInputValue() },
  });

  // Each preview is a blob URL holding the whole file in memory; release it
  // when it is replaced or the form unmounts.
  useEffect(() => {
    if (previewUrl === null) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function acceptFile(chosen: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(chosen.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      // R6 (resolved 2026-10-24, security.md R6): HEIC/HEIF gets specific,
      // actionable guidance instead of a generic rejection — a best-effort
      // client-side check only; the server-side allowlist is unchanged.
      setStage("error");
      setError(isLikelyHeic(chosen) ? HEIC_GUIDANCE_MESSAGE : "Please choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (chosen.size > MAX_IMAGE_BYTES) {
      setStage("error");
      setError("That image is larger than 15 MB. Choose a smaller one, or export a lower-resolution copy.");
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
      setError("The upload didn't complete. Check your connection and try again.");
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

  const isBusy = stage === "uploading" || stage === "finalizing" || stage === "done";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <UploadDropzone
        icon={ImagePlus}
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        inputLabel="Photo"
        hasFile={file !== null}
        disabled={isBusy}
        onFile={acceptFile}
        guidance="JPEG, PNG, WebP, or GIF, up to 15 MB."
        preview={
          previewUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a Storage URL (architecture §9).
            <img src={previewUrl} alt="Selected photo preview" className="size-full object-contain" />
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>The story around it</CardTitle>
          <CardDescription>
            A line about the moment, the event it belonged to, and when it happened.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FormField
            label="Caption"
            hint="Optional. Up to 2000 characters."
            error={errors.caption?.message}
            render={({ inputId, describedBy }) => (
              <Textarea
                id={inputId}
                placeholder="Last night in the hostel before everyone left…"
                aria-invalid={errors.caption !== undefined}
                aria-describedby={describedBy}
                {...register("caption")}
              />
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Event"
              hint="Optional."
              error={errors.eventName?.message}
              render={({ inputId, describedBy }) => (
                <Input
                  id={inputId}
                  placeholder="Farewell night"
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
          </div>
        </CardContent>
      </Card>

      {(stage === "uploading" || stage === "finalizing") && <UploadProgress stage={stage} />}

      {error !== null && <FormMessage tone="error">{error}</FormMessage>}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="submit" size="lg" disabled={isBusy || file === null}>
          {isBusy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          {stage === "uploading"
            ? "Uploading…"
            : stage === "finalizing" || stage === "done"
              ? "Saving…"
              : "Add to batch"}
        </Button>
      </div>
    </form>
  );
}
