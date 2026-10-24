# features/memories

Owns: memory records and the gallery/timeline/detail read paths, with keyset
pagination and soft-deleted content absent from every read path
(architecture §19; security.md §5.4).

**Phase 4A (complete):** the "minimal verification list" — creation only,
via `features/media`'s `finalize_memory` RPC. No direct client DML at all.

**Phase 4B (complete):** author EDIT of `caption`/`event_name`/`occurred_on`
via policy-checked direct DML (`memories_update_own` + a column-level
GRANT) — not an RPC. **No author self-delete** (PRD #7, resolved
2026-10-24): removal of any memory is mod+ only, via the Phase 8A
moderator-removal path, not yet built.

Real gallery/timeline read surfaces arrive in **Phase 5A/5B**
(`docs/phases.md`).
