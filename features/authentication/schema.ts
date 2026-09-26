import { z } from "zod";

/**
 * Validation schemas for the authentication domain (rules.md §1.6).
 *
 * Every Server Action re-validates with these regardless of what React Hook
 * Form already checked client-side — client validation is a UX layer only.
 */

// Supabase's own minimum is configurable per project; 8 is this product's
// floor and is intentionally at or above whatever the project requires, so a
// password that passes here is never rejected downstream for being too short.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254, "Email address is too long.");

export const signUpInputSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const signInInputSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Enter your password."),
  })
  .strict();

export const requestPasswordResetInputSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const updatePasswordInputSchema = z
  .object({
    password: passwordSchema,
  })
  .strict();

export type SignUpInput = z.infer<typeof signUpInputSchema>;
export type SignInInput = z.infer<typeof signInInputSchema>;
export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetInputSchema
>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordInputSchema>;
