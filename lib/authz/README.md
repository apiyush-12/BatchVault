# lib/authz

Capability and role-hierarchy boundary (architecture §16–17). Implemented in
Phase 2, once `batch_members` exists.

`roles.ts` is the **single place the role hierarchy is expressed in
application code**, mirroring `public.batch_role`'s declaration order
(database.md §15) so the same comparison is never re-implemented per feature.
Owner > Admin > Moderator > Member.

Two things this module is never:

- a substitute for the database boundary — it is Layer 2 defense in depth,
  while RLS and each privileged RPC's own checks are the guarantee
  (architecture §5; security.md §3, §5.2.2);
- a place that trusts a caller-supplied role. The actor's role always comes
  from `batch_members` (via `public.my_batch_role()` server-side), never
  accepted from input (security.md §11).
