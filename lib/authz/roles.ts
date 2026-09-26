/**
 * Role hierarchy mirroring `public.batch_role` (database.md §15; security.md
 * §5.3, §11). Order matters and must match the enum's declaration order
 * exactly — Postgres compares `batch_role` by declaration order, and this
 * array is the single place that ordering is expressed in application code
 * (architecture §5, §17).
 *
 * This is Layer 2 (defense in depth / good errors) only. It is never the
 * authorization guarantee — the database's own checks (RLS, and each
 * privileged RPC's own logic) are (architecture §5; security.md §3, §11).
 * Nothing here ever trusts a caller-supplied role; the actual role always
 * comes from `batch_members` via the server (security.md §11).
 */

export type BatchRole = "member" | "moderator" | "admin" | "owner";

const ROLE_ORDER: readonly BatchRole[] = ["member", "moderator", "admin", "owner"];

export function roleRank(role: BatchRole): number {
  return ROLE_ORDER.indexOf(role);
}

/** `role` outranks or equals `minimum`. A `null` role (not an active member) never qualifies. */
export function hasAtLeastRole(
  role: BatchRole | null | undefined,
  minimum: BatchRole,
): boolean {
  if (role === null || role === undefined) {
    return false;
  }
  return roleRank(role) >= roleRank(minimum);
}
