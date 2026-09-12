# types/

Generated database types and shared cross-domain types (architecture §16).

**Empty in Phase 0 — no application table exists yet.** Once the first tables
ship, database types are *generated* from the live schema and imported by each
feature's data layer (rules.md §1.1). A hand-written duplicate of a table shape
is drift waiting to happen and is not permitted.

Domain types live beside their domain in `features/<domain>/types.ts`, not
here.
