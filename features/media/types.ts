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
