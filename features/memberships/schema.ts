import { z } from "zod";

/**
 * Validation schemas for the memberships write side (rules.md §1.6; Phase
 * 3B). `newRole` deliberately excludes `'owner'` — ownership never moves
 * through `change_member_role`, only through `transferOwnershipAction`
 * (security.md §11 rule 1; database.md §13) — so an invalid value fails
 * here with a clear message rather than reaching the database only to be
 * refused generically.
 */

const targetMemberInputSchema = z.object({
  batchId: z.string().uuid(),
  profileId: z.string().uuid(),
});

export const approveMemberInputSchema = targetMemberInputSchema.strict();
export const rejectMemberInputSchema = targetMemberInputSchema.strict();
export const removeMemberInputSchema = targetMemberInputSchema.strict();

export const changeMemberRoleInputSchema = targetMemberInputSchema
  .extend({
    newRole: z.enum(["member", "moderator", "admin"]),
  })
  .strict();

export const transferOwnershipInputSchema = z
  .object({
    batchId: z.string().uuid(),
    newOwnerProfileId: z.string().uuid(),
    // The highest-tier confirmation this phase can build without a modal
    // primitive this repository has not yet vendored (design.md §13-16):
    // the admin must type the exact target display name.
    confirmDisplayName: z.string().trim().min(1),
  })
  .strict();

export type ApproveMemberInput = z.infer<typeof approveMemberInputSchema>;
export type RejectMemberInput = z.infer<typeof rejectMemberInputSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberInputSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleInputSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipInputSchema>;
