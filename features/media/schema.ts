import { z } from "zod";

import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./types";

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

const captionSchema = z
  .string()
  .trim()
  .max(2000, "Caption must be 2000 characters or fewer.")
  .optional();

const eventNameSchema = z
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
  })
  .strict();

export type RequestPhotoUploadInput = z.infer<typeof requestPhotoUploadInputSchema>;
export type FinalizeMemoryInput = z.infer<typeof finalizeMemoryInputSchema>;
