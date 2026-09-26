import { hasAtLeastRole, type BatchRole } from "@/lib/authz/roles";

/**
 * Layer-2 capability checks for the memberships domain (architecture §5;
 * §17). Convenience/UX only — approval/removal/role-change RPCs and their
 * own database-side ceilings arrive in Phase 3B; this phase is read-side
 * only (phases.md Phase 2).
 */

/** Mod+ can see the report/approval queue and roster management controls (security.md §4). */
export function canManageMembers(role: BatchRole | null): boolean {
  return hasAtLeastRole(role, "moderator");
}
