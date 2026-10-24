export type MediaKind = "image" | "video";
export type MediaStatus = "pending" | "ready" | "rejected";

export interface MediaAsset {
  id: string;
  batchId: string;
  memoryId: string | null;
  kind: MediaKind;
  status: MediaStatus;
  storagePath: string;
  mimeType: string | null;
  byteSize: number | null;
  position: number;
  posterMediaAssetId: string | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Phase 4A: image only (security.md §15). No SVG, no HEIC. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** 15 MiB — this phase's chosen image cap, mirrored from the RPC (security.md §16). */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Phase 4B (phases.md): `video/mp4` (H.264 + AAC) only — "the combination
 * that plays natively without transcoding" (architecture §10). No other
 * video container/codec is accepted.
 */
export const ALLOWED_VIDEO_TYPES = ["video/mp4"] as const;

/**
 * 100 MiB — this implementation's own chosen video cap (security.md §16:
 * "exact figures are a product/ops decision"), mirrored from the RPC.
 * Revisitable without a schema change, same latitude as the image cap.
 */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/**
 * 90 seconds — a SOFT, client-side-only duration cap (ADR-08a: "duration
 * and codec cannot be proven from object metadata"). This is UX guidance,
 * never enforced server-side; the hard size cap above is the one
 * authoritative bound.
 */
export const MAX_VIDEO_DURATION_SECONDS = 90;

/**
 * R6 (resolved 2026-10-24, security.md R6): HEIC/HEIF stays excluded from
 * the server-side allowlist — no transcoding pipeline exists or is added.
 * This is a client-side, BEST-EFFORT advisory check only (file extension
 * and/or declared type, since the client is never trusted for anything
 * authoritative) — it exists purely to show better guidance than a
 * generic "unsupported file type" message. The server-side allowlist and
 * its rejection behavior are completely unchanged by this.
 */
export function isLikelyHeic(file: { name: string; type: string }): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif")
  );
}

export const HEIC_GUIDANCE_MESSAGE =
  "HEIC photos aren't supported yet. On iPhone, go to Settings → Camera → Formats and choose \"Most Compatible,\" or pick \"Keep Original\" when sharing this photo so it exports as JPEG.";
