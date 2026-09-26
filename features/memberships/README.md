# features/memberships

**Read side implemented in Phase 2 — Batch Spaces.** Owner bootstrap happens
inside `features/batches`' `create_batch` RPC, not here — this module has no
`actions.ts` yet.

- `queries.ts` — `listBatchMembers()` (the roster; RLS decides whether the
  caller sees the full roster or only their own pending row, security.md
  §5.4), `getMyMembership()`.
- `permissions.ts` — `canManageMembers()`, Layer 2 only; nothing yet acts on
  it, since approval/rejection/removal/role-change RPCs are Phase 3B.

Owns: the `batch_members` roster, join-request state, approval/rejection/
removal, role changes and ownership transfer — all RPC-only, with rank
ceilings enforced database-side (security.md §5.2, §11). A caller can never
create their own membership row by supplying a batch id (verified by test).

The decision/role write side (`approve`/`reject`/`remove`, role changes,
ownership transfer) arrives in **Phase 3B** (`docs/phases.md`).
