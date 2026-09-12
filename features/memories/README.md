# features/memories

Domain boundary only — **not implemented in Phase 0**.

Owns: memory records and the gallery/timeline/detail read paths, with keyset
pagination and soft-deleted content absent from every read path
(architecture §19; security.md §5.4).

Arrives in **Phase 4A** (write path, via media finalize) and **Phase 5A/5B**
(read surfaces) (`docs/phases.md`).
