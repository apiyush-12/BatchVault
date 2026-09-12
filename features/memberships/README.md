# features/memberships

Domain boundary only — **not implemented in Phase 0**.

Owns: the `batch_members` roster, join-request state, approval/rejection/
removal, role changes and ownership transfer — all RPC-only, with rank
ceilings enforced database-side (security.md §5.2, §11). A caller can never
create their own membership row by supplying a batch id.

Read side arrives in **Phase 2**; the decision/role write side in **Phase 3B**
(`docs/phases.md`).
