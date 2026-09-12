# features/comments

Domain boundary only — **not implemented in Phase 0**.

Owns: flat, chronological comments — no threading. Visibility and write access
both inherit the parent memory's visibility (security.md §5.4.2), and
`author_id` is bound to `auth.uid()` by the database.

Arrives in **Phase 6 — Comments & Reactions** (`docs/phases.md`).
