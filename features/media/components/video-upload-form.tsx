"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Video as VideoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { todayDateInputValue } from "@/lib/format/date";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { finalizeMemoryAction, requestPhotoUploadAction, requestVideoUploadAction } from "../actions";
import { finalizeMemoryInputSchema, type FinalizeMemoryInput } from "../schema";
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_SECONDS } from "../types";
import { UploadDropzone } from "./upload-dropzone";
import { UploadProgress } from "./upload-progress";

type Stage = "idle" | "capturing" | "uploading" | "finalizing" | "error" | "done";

type FormValues = Omit<FinalizeMemoryInput, "mediaAssetId" | "posterMediaAssetId">;

/**
 * Short-video upload (phases.md Phase 4B). Same two-phase flow as
 * `PhotoUploadForm`, plus a best-effort client-captured poster frame — a
 * failed capture is an ordinary, expected outcome (never a blocking
 * error): the video still uploads with no poster, and the gallery falls
 * back to a neutral placeholder (phases.md Phase 4B; design.md §11). The
 * duration check below is explicitly a SOFT, client-side-only UX check
 * (ADR-08a) — it warns, it never blocks submission, and the server never
 * enforces it.
 */
export function VideoUploadForm({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(finalizeMemoryInputSchema.omit({ mediaAssetId: true, posterMediaAssetId: true })),
    defaultValues: { occurredOn: todayDateInputValue() },
  });

  // Each preview is a blob URL holding the whole file in memory; release it
  // when it is replaced or the form unmounts.
  useEffect(() => {
    if (previewUrl === null) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  /**
   * Reads real video metadata/a frame in a hidden, never-mounted <video>
   * element. Every failure path here is swallowed — a capture problem must
   * never surface as a user-facing error (header comment above).
   */
  function captureFromVideo(chosen: File): void {
    setDurationSeconds(null);
    setDurationWarning(null);
    setPosterBlob(null);

    const objectUrl = URL.createObjectURL(chosen);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.muted = true;
    videoEl.src = objectUrl;

    videoEl.addEventListener("loadedmetadata", () => {
      const duration = Math.round(videoEl.duration);
      if (Number.isFinite(duration) && duration > 0) {
        setDurationSeconds(duration);
        if (duration > MAX_VIDEO_DURATION_SECONDS) {
          setDurationWarning(
            `This video looks like it's about ${duration}s long — longer than our ${MAX_VIDEO_DURATION_SECONDS}s guideline for short videos. This is just a heads-up from your browser, not a hard limit; it may still upload fine.`,
          );
        }
      }
      // Seek slightly past the start — frame 0 of many phone recordings is
      // a black/transitional frame.
      videoEl.currentTime = Math.min(0.1, videoEl.duration || 0);
    });

    videoEl.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx === null || canvas.width === 0 || canvas.height === 0) {
          return;
        }
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob !== null) {
              setPosterBlob(blob);
            }
          },
          "image/jpeg",
          0.85,
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    });

    videoEl.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
    });
  }

  function acceptFile(chosen: File) {
    if (!ALLOWED_VIDEO_TYPES.includes(chosen.type as (typeof ALLOWED_VIDEO_TYPES)[number])) {
      setStage("error");
      setError("Only MP4 videos are supported. If your phone saved this as .mov, convert or export it as MP4 first.");
      return;
    }
    if (chosen.size > MAX_VIDEO_BYTES) {
      setStage("error");
      setError("That video is larger than 100 MB. Trim it or export a smaller version and try again.");
      return;
    }
    setStage("idle");
    setError(null);
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
    setStage("capturing");
    captureFromVideo(chosen);
    setStage("idle");
  }

  async function onSubmit(values: FormValues) {
    if (file === null) {
      setError("Choose a video first.");
      return;
    }

    setStage("uploading");
    setError(null);

    const requestedVideo = await requestVideoUploadAction({
      batchId,
      declaredMimeType: file.type,
      declaredSize: file.size,
      originalFilename: file.name,
      clientReportedDurationSeconds: durationSeconds ?? undefined,
    });
    if (!requestedVideo.ok) {
      setStage("error");
      setError(requestedVideo.error);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from("batch-media")
      .uploadToSignedUrl(requestedVideo.data.path, requestedVideo.data.token, file);

    if (uploadError !== null) {
      setStage("error");
      setError("The upload didn't complete. Check your connection and try again — large videos can take a while on mobile data.");
      return;
    }

    // Poster upload is best-effort: any failure here is swallowed and the
    // memory still finalizes without a poster (header comment above).
    let posterMediaAssetId: string | undefined;
    if (posterBlob !== null) {
      const posterFile = new File([posterBlob], "poster.jpg", { type: "image/jpeg" });
      const requestedPoster = await requestPhotoUploadAction({
        batchId,
        declaredMimeType: posterFile.type,
        declaredSize: posterFile.size,
        originalFilename: posterFile.name,
      });
      if (requestedPoster.ok) {
        const { error: posterUploadError } = await supabase.storage
          .from("batch-media")
          .uploadToSignedUrl(requestedPoster.data.path, requestedPoster.data.token, posterFile);
        if (posterUploadError === null) {
          posterMediaAssetId = requestedPoster.data.mediaAssetId;
        }
      }
    }

    setStage("finalizing");

    const finalized = await finalizeMemoryAction({
      mediaAssetId: requestedVideo.data.mediaAssetId,
      posterMediaAssetId,
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
        icon={VideoIcon}
        accept={ALLOWED_VIDEO_TYPES.join(",")}
        inputLabel="Video"
        hasFile={file !== null}
        disabled={isBusy}
        onFile={acceptFile}
        guidance="MP4 only, up to 100 MB. Short videos (a minute or two) work best."
        preview={
          previewUrl !== null ? (
            <video src={previewUrl} muted playsInline preload="metadata" className="size-full object-contain" />
          ) : null
        }
      />

      {durationWarning !== null && (
        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-body-sm text-foreground">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{durationWarning}</span>
        </p>
      )}

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
                placeholder="The walk out of the main gate, one last time…"
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
                  placeholder="Graduation day"
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
