# features/profiles

Domain boundary only — **not implemented in Phase 0**.

Owns: the `profiles` table's read/write surface, profile onboarding, and the
controlled avatar upload flow. Writable columns are `display_name` and `bio`
only; `onboarding_completed_at` and `avatar_path` change through the controlled
write paths in security.md §5.4.3, never by ordinary DML.

Arrives in **Phase 1 — Authentication & Profile** (`docs/phases.md`).
