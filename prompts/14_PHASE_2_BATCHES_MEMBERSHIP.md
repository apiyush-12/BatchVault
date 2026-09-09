# Prompt 14 — Implement Phase 2: Batch Spaces & Membership

Read:

- `/docs/memory.md`
- Phase 2 in `/docs/phases.md`
- relevant `/docs/PRD.md`
- `/docs/database.md`
- `/docs/security.md`
- `/docs/rules.md`
- `/docs/design.md`
- relevant `/docs/testing.md`

Implement ONLY Phase 2.

## Expected focus

Follow phases.md exactly, but this phase should center on:

- create batch
- batch identity
- college/course/department/year/section data
- batch slug or identifier
- default privacy
- owner membership
- member role model
- batch home shell
- member list basics
- batch settings basics

Do not implement invite links unless Phase 2 explicitly includes them.
Do not implement media uploads.

## Security priority

RLS must prevent unrelated users from accessing private batch records.

Create migrations for schema/policy changes.

Add tests proving batch isolation.

## Completion

Run quality checks.

Update `/docs/memory.md`.

Report:
- what works,
- security tests,
- migrations,
- known issues,
- next phase.

Then STOP.
