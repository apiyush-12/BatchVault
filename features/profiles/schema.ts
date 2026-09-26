import { z } from "zod";

/**
 * Validation schemas for the profiles domain (rules.md §1.6).
 *
 * Limits mirror database.md §3.1's CHECK constraints exactly (security.md
 * §13), so a bad request fails early with a clear message rather than a raw
 * constraint violation later.
 */

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a display name.")
  .max(80, "Display name must be 80 characters or fewer.");

const bioSchema = z
  .string()
  .trim()
  .max(500, "Bio must be 500 characters or fewer.")
  .optional();

// Allowlist, never denylist (rules.md §1.6): unknown fields are rejected
// outright. `id`, `avatarPath`, `onboardingCompletedAt` and every timestamp
// are deliberately absent — none of them is client-writable (security.md
// §5.4.1).
export const onboardingInputSchema = z
  .object({
    displayName: displayNameSchema,
    bio: bioSchema,
  })
  .strict();

export const updateProfileInputSchema = onboardingInputSchema;

// The controlled avatar write path takes only a path this same server issued
// moments earlier (`{auth.uid()}/{uuid}`) — never an arbitrary string.
export const avatarObjectPathSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid avatar object path.",
  );

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
