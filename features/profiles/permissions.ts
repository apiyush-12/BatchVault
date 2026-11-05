/**
 * Capability checks for the profiles domain (architecture §16–17).
 *
 * One rule: a caller may act only on their own row. Reading co-members'
 * profiles (security.md §5.4) is a read, enforced by RLS, not a capability
 * check here.
 */
export function isOwnProfile(callerId: string, profileId: string): boolean {
  return callerId === profileId;
}
