import { roleRank, type BatchRole } from "@/lib/authz/roles";

/**
 * Layer-2 capability checks for the memberships domain (architecture §5;
 * §17). Convenience/UX only — the real guarantee is each privileged RPC's
 * own database-side ceiling check (security.md §3, §4, §11, §5.2.2).
 */

/** Mod+ can see the report/approval queue and roster management controls (security.md §4). */
export function canManageMembers(role: BatchRole | null): boolean {
  return role !== null && roleRank(role) >= roleRank("moderator");
}

/** Mod+ can approve or reject a pending join request (security.md §4). */
export function canDecideJoinRequests(role: BatchRole | null): boolean {
  return role !== null && roleRank(role) >= roleRank("moderator");
}

/**
 * The one ceiling comparison mirrored from `remove_member`/
 * `change_member_role` (security.md §4, §11 rules 1-2): the actor must
 * outrank the target's current role, and — for a role change — must also
 * outrank the role being assigned. Never trusted as the boundary; the RPC
 * re-derives everything from `auth.uid()` regardless of what this returns.
 */
export function canRemoveMember(actorRole: BatchRole | null, targetRole: BatchRole): boolean {
  return actorRole !== null && roleRank(actorRole) > roleRank(targetRole);
}

export function canAssignRole(
  actorRole: BatchRole | null,
  targetRole: BatchRole,
  newRole: BatchRole,
): boolean {
  if (newRole === "owner") {
    // Ownership never moves through this path (security.md §11 rule 1).
    return false;
  }
  return (
    actorRole !== null &&
    roleRank(actorRole) > roleRank(targetRole) &&
    roleRank(actorRole) > roleRank(newRole)
  );
}

/** Only the owner can transfer ownership (security.md §4, §11). */
export function canTransferOwnership(role: BatchRole | null): boolean {
  return role === "owner";
}

/** The assignable roles a given actor could ever grant, for building a role-select control. */
export function assignableRoles(actorRole: BatchRole | null): BatchRole[] {
  if (actorRole === null) return [];
  const rank = roleRank(actorRole);
  return (["member", "moderator", "admin"] as const).filter((role) => roleRank(role) < rank);
}
