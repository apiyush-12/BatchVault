import { hasAtLeastRole, type BatchRole } from "@/lib/authz/roles";

/**
 * Layer-2 capability checks for the batches domain (architecture §5; §17).
 * Convenience/UX only — the guarantee is the database's own RLS and each
 * privileged RPC's own authorization logic (security.md §3, §5.2.2, §11).
 */

/** Admin+ can change batch identity/settings/join policy (security.md §4). */
export function canEditBatchSettings(role: BatchRole | null): boolean {
  return hasAtLeastRole(role, "admin");
}

/** Owner-only: deleting (and restoring) the batch itself (PRD #6; security.md §4). */
export function canDeleteBatch(role: BatchRole | null): boolean {
  return role === "owner";
}
