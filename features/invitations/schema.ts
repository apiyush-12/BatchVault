import { z } from "zod";

/**
 * Validation schemas for the invitations domain (rules.md §1.6).
 *
 * `maxUses`/`expiresInDays` limits mirror database.md §3.4's CHECK
 * constraints (security.md §13) — a bad request fails early with a clear
 * message rather than a raw constraint violation later.
 */

export const createInviteInputSchema = z
  .object({
    batchId: z.string().uuid(),
    // Plain strings end-to-end in the form-facing schema (matching
    // features/batches/schema.ts's graduationYear precedent) — numeric
    // conversion happens once, in actions.ts, right before the RPC call.
    maxUses: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[1-9]\d*$/.test(value), "Enter a positive number.")
      .optional(),
    expiresInDays: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[1-9]\d*$/.test(value), "Enter a positive number.")
      .optional(),
  })
  .strict();

export const revokeInviteInputSchema = z
  .object({
    inviteId: z.string().uuid(),
    batchId: z.string().uuid(),
  })
  .strict();

// A redeemed/validated token is read from the URL fragment, never a query
// string (security.md §9.1). Length-capped generously above the real
// token's encoded size so an oversized value fails validation here rather
// than reaching the database.
const tokenSchema = z.string().trim().min(1, "Invite link is missing its token.").max(512);

export const validateInviteInputSchema = z.object({ token: tokenSchema }).strict();
export const redeemInviteInputSchema = z.object({ token: tokenSchema }).strict();

export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;
export type RevokeInviteInput = z.infer<typeof revokeInviteInputSchema>;
export type ValidateInviteInput = z.infer<typeof validateInviteInputSchema>;
export type RedeemInviteInput = z.infer<typeof redeemInviteInputSchema>;
