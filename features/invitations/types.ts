export interface Invite {
  id: string;
  batchId: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Redemption outcome returned by `redeem_invite` (database.md §3.3's
 * `membership_status`, narrowed to the two states redemption can produce —
 * `rejected`/`removed`/`left` never come back from a fresh redemption).
 */
export type RedemptionStatus = "active" | "pending";

export interface RedemptionResult {
  batchId: string;
  batchName: string;
  status: RedemptionStatus;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * One generic message for every expected invite failure — invalid, expired,
 * revoked, exhausted, already-removed, or rate-limited. Never disclose which
 * (security.md §9, §17: "indistinguishable denial").
 */
export const GENERIC_INVITE_ERROR =
  "This invite link isn't valid. Ask whoever shared it for a new one.";

export const GENERIC_ERROR = "Something went wrong. Please try again.";
