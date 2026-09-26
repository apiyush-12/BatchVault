"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { confirmAvatarUploadAction, requestAvatarUploadAction } from "../actions";

// UX guard only — never the authoritative check. Finalize-equivalent
// enforcement lives in the controlled write path itself (architecture §8,
// ADR-08a; security.md §14).
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Own-avatar upload through a controlled flow with a server-composed path
 * (phases.md Phase 1; security.md §6.1). The client never chooses the path:
 * the server issues it, the browser uploads directly to Storage, then the
 * server-side controlled write path records it.
 */
export function AvatarUploader({
  initialAvatarUrl,
  onUploaded,
}: {
  initialAvatarUrl: string | null;
  onUploaded?: (avatarUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialAvatarUrl);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStatus("error");
      setError("Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setStatus("error");
      setError("That image is larger than 5 MB.");
      return;
    }

    setStatus("uploading");
    setError(null);

    const requested = await requestAvatarUploadAction();
    if (!requested.ok) {
      setStatus("error");
      setError(requested.error);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .uploadToSignedUrl(requested.data.path, requested.data.token, file);

    if (uploadError !== null) {
      setStatus("error");
      setError("The upload didn't complete. Please try again.");
      return;
    }

    const confirmed = await confirmAvatarUploadAction(requested.data.path);
    if (!confirmed.ok) {
      setStatus("error");
      setError(confirmed.error);
      return;
    }

    setStatus("idle");
    setPreviewUrl(confirmed.data.avatarUrl);
    onUploaded?.(confirmed.data.avatarUrl);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-surface-sunken">
        {previewUrl !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL is a poor next/image cache key (architecture §9).
          <img
            src={previewUrl}
            alt="Your avatar"
            className="size-full object-cover"
          />
        ) : (
          <ImagePlus aria-hidden="true" className="size-6 text-foreground-muted" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={status === "uploading"}
          onClick={() => inputRef.current?.click()}
        >
          {status === "uploading" ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Uploading…
            </>
          ) : (
            "Choose photo"
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          aria-label="Avatar image"
          onChange={handleFileChange}
        />
        {error !== null && (
          <p role="alert" className="text-caption font-medium text-danger">
            {error}
          </p>
        )}
        <p className="text-caption text-foreground-muted">Optional. JPEG, PNG or WebP, up to 5 MB.</p>
      </div>
    </div>
  );
}
