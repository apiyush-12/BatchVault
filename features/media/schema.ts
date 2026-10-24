import { z } from "zod";

import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "./types";

/**
 * Validation schemas for the media domain (rules.md §1.6). Limits mirror
 * the `preallocate_media`/`finalize_memory` RPCs' own checks exactly
 * (security.md §13) — a bad request fails early with a clear message
 * rather than a raw RPC refusal later. The RPCs re-check regardless; these
 * never substitute for that (rules.md §1.6).
 */

export const requestPhotoUploadInputSchema = z
  .object({
    batchId: z.string().uuid(),
    declaredMimeType: z.enum(ALLOWED_IMAGE_TYPES),
    declaredSize: z
      .number()
      .int()
      .positive()
      .max(MAX_IMAGE_BYTES, "That image is larger than 15 MB."),
    originalFilename: z.string().trim().max(255).optional(),
  })
  .strict();

/**
 * Phase 4B: video/mp4 only, with its own size cap. `clientReportedDurationSeconds`
 * is accepted and stored, but is purely advisory (ADR-08a) — never an
 * enforcement input, here or at the RPC.
 */
export const requestVideoUploadInputSchema = z
  .object({
    batchId: z.string().uuid(),
    declaredMimeType: z.enum(ALLOWED_VIDEO_TYPES),
    declaredSize: z
      .number()
      .int()
      .positive()
      .max(MAX_VIDEO_BYTES, "That video is larger than 100 MB."),
    originalFilename: z.string().trim().max(255).optional(),
    clientReportedDurationSeconds: z.number().int().positive().optional(),
  })
  .strict();

export const captionSchema = z
  .string()
  .trim()
  .max(2000, "Caption must be 2000 characters or fewer.")
  .optional();

export const eventNameSchema = z
  .string()
  .trim()
  .max(200, "Event name must be 200 characters or fewer.")
  .optional();

export const finalizeMemoryInputSchema = z
  .object({
    mediaAssetId: z.string().uuid(),
    caption: captionSchema,
    eventName: eventNameSchema,
    // A plain date string (YYYY-MM-DD) — content, not a system timestamp
    // (security.md §13's "content timestamps" category).
    occurredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date."),
    // Phase 4B: the client-captured poster-frame companion image's own
    // media asset id, if capture succeeded. Optional — a failed capture
    // simply omits this, and finalize_memory tolerates that (phases.md
    // Phase 4B: "neutral on-brand placeholder when capture fails").
    posterMediaAssetId: z.string().uuid().optional(),
  })
  .strict();

export type RequestPhotoUploadInput = z.infer<typeof requestPhotoUploadInputSchema>;
export type RequestVideoUploadInput = z.infer<typeof requestVideoUploadInputSchema>;
export type FinalizeMemoryInput = z.infer<typeof finalizeMemoryInputSchema>;
