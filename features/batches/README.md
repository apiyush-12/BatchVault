# features/batches

Implemented in **Phase 2 — Batch Spaces**.

Owns batch identity, settings, and the atomic create-batch-with-owner RPC
(security.md §5.2.1) — a batch and its first owner come into existence
together, or neither does. Batches are never discoverable (security.md §10).

- `queries.ts` — `listMyBatches()` (the batch switcher's data source),
  `getBatchById()`. Both ordinary policy-governed reads; `batches` is
  RPC-only for every write (security.md §5.2).
- `actions.ts` — `createBatchAction` (calls `create_batch`, redirects into
  the new batch on success), `updateBatchSettingsAction` (calls
  `update_batch_settings`, admin+ only — enforced by the RPC, not here).
- `permissions.ts` — `canEditBatchSettings()`, Layer 2 only.
- No `components/` colocated here yet; the create/settings forms live under
  `app/(app)/batches/...` for this phase and can move into this module's
  `components/` later if reused elsewhere.

`visibility` is not exposed as a setting: `batch_visibility` has exactly one
legal value (`'private'`) today (ADR-12), so there is nothing to choose.
`join_policy` **is** exposed and owner/admin-configurable (PRD.md unresolved
#1–2, resolved this phase; database.md Q1).

No invite links, join requests, approval, role changes, ownership transfer,
or member removal — all Phase 3.
