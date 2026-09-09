# Prompt 15 — Implement Phase 3: Invitations & Join Flow

Read:

- `/docs/memory.md`
- Phase 3 in `/docs/phases.md`
- relevant `/docs/PRD.md`
- `/docs/database.md`
- `/docs/security.md`
- `/docs/rules.md`
- `/docs/design.md`
- relevant `/docs/testing.md`

Implement ONLY Phase 3.

## Focus

Follow phases.md exactly.

Expected capabilities:

- create secure batch invite
- invite code/link
- optional expiration
- revoke invite
- join using invite
- prevent unauthorized reuse if the model requires it
- join request/approval if configured
- membership creation
- appropriate success/error states
- member list refresh

## Required security cases

Test:

- invalid invite
- expired invite
- revoked invite
- unauthorized batch access
- duplicate membership
- removed user behavior
- role restrictions around creating/revoking invites

Do not implement photo upload.

Update `/docs/memory.md` when done.

Report verification results and STOP.
