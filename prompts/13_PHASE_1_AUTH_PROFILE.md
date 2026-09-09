# Prompt 13 — Implement Phase 1: Authentication & Profile

Read:

- `/docs/memory.md`
- Phase 1 in `/docs/phases.md`
- relevant sections of `/docs/architecture.md`
- `/docs/security.md`
- `/docs/rules.md`
- `/docs/design.md`
- relevant schema in `/docs/database.md`
- relevant tests in `/docs/testing.md`

Implement ONLY Phase 1.

## Scope

Use the exact Phase 1 scope in phases.md.

Expected features may include:

- signup
- login
- logout
- email verification
- password reset
- protected routes
- profile onboarding
- basic account settings

## Security

Do not expose privileged Supabase keys to client code.
Do not weaken RLS.
Do not treat frontend route protection as sufficient authorization.

## UX

Implement:
- loading states
- validation errors
- success feedback
- mobile layout
- keyboard/focus states
- accessible forms

## Tests

Implement and run the Phase 1 tests specified in testing.md.

## Completion

Update `/docs/memory.md`.

Report:
- migrations,
- important files,
- tests run,
- known issues,
- exact next phase.

Then STOP.

Do not implement batch creation.
