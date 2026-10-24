import { hasAtLeastRole, type BatchRole } from "@/lib/authz/roles";

/** Layer 2 only — mirrors `list_open_reports`/`remove_content`/`restore_content`'s own mod+ check. */
export function canModerate(role: BatchRole | null): boolean {
  return hasAtLeastRole(role, "moderator");
}

/** Layer 2 only — mirrors `list_audit_log`'s own admin+ check. */
export function canViewAuditLog(role: BatchRole | null): boolean {
  return hasAtLeastRole(role, "admin");
}
