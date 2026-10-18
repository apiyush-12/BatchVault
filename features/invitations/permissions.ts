import { hasAtLeastRole, type BatchRole } from "@/lib/authz/roles";

/**
 * Layer-2 capability checks for the invitations domain (architecture §5;
 * §17). Convenience/UX only — the guarantee is `create_invite`/
 * `revoke_invite`'s own database-side admin+ check (security.md §3, §9,
 * §11, §5.2.2).
 */

/** Admin+ can create and revoke invites (security.md §4, §9). */
export function canManageInvites(role: BatchRole | null): boolean {
  return hasAtLeastRole(role, "admin");
}
