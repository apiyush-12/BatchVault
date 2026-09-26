/**
 * Capability checks for the profiles domain (architecture §16–17).
 *
 * Phase 1 has exactly one rule: a caller may act only on their own row. The
 * "other profiles where a batch is shared" clause (security.md §5.4) has no
 * `batch_members` to consult until Phase 2, so it is not approximated here —
 * it is added when that table exists, not stubbed now.
 */
export function isOwnProfile(callerId: string, profileId: string): boolean {
  return callerId === profileId;
}
