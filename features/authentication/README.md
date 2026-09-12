# features/authentication

Domain boundary only — **not implemented in Phase 0**.

Owns: Supabase Auth signup, email verification, login, logout and password
reset, wired to the supported Supabase SSR cookie/session strategy
(architecture §4; security.md §2). No custom crypto and no custom session
store.

Arrives in **Phase 1 — Authentication & Profile** (`docs/phases.md`).
