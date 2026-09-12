# features/batches

Domain boundary only — **not implemented in Phase 0**.

Owns: batch identity and settings, and the atomic create-batch-with-owner RPC
(security.md §5.2.1) — a batch and its first owner come into existence
together, or neither does. Batches are never discoverable (security.md §10).

Arrives in **Phase 2 — Batch Spaces**, which additionally requires **B2 signed
off** (`docs/phases.md`).
