# lib/validation

Shared validation boundary (architecture §16) — **empty in Phase 0.**

Zod is the single validation library (rules.md §1.6). Shared primitives land
here only when two domains genuinely need the same one; a schema used by one
domain belongs in that domain's `schema.ts`.

Rules that apply to every schema written here or in a domain:

- allowlist, never denylist — unknown fields are rejected, not stripped;
- limits mirror the database `CHECK` constraints so the two cannot drift;
- UUIDs are validated as UUIDs before reaching a query;
- identity, role, membership, batch-ownership claims, storage paths and system
  timestamps are never trusted from client input, whatever the schema allows
  through (security.md §13).
