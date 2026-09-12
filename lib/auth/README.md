# lib/auth

Session helpers (architecture §16) — **empty in Phase 0.**

Will hold the server-side helpers for reading the verified Supabase session,
so Server Components and Server Actions derive the acting user from the
session and never from client input (architecture §4, §18.4).

Auth flows themselves belong to `features/authentication`, which arrives in
Phase 1. The Supabase clients this will build on already exist in
`lib/supabase/`.
