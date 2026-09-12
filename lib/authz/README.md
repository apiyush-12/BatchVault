# lib/authz

Capability and role-hierarchy boundary (architecture §16–17) — **skeleton
only; no logic in Phase 0.**

When roles exist, this is the **single place the role hierarchy is expressed in
application code**, mirroring the SQL helper functions so the same comparison
is never re-implemented per feature. Owner > Admin > Moderator > Member.

Two things this module will never be:

- a substitute for the database boundary — it is Layer 2 defense in depth,
  while RLS, Storage RLS and a privileged function's own checks are the
  guarantee (architecture §5; security.md §3);
- a place that trusts a caller-supplied role. The actor's role is resolved
  from `batch_members`, never accepted from input (security.md §11).

`batch_members` does not exist until Phase 2, so there is deliberately nothing
to implement here yet.
