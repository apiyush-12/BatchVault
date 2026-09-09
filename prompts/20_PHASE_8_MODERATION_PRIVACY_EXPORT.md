# Prompt 20 — Implement Phase 8: Moderation, Privacy & Export

Read:

- `/docs/memory.md`
- Phase 8 in `/docs/phases.md`
- `/docs/security.md`
- `/docs/database.md`
- `/docs/rules.md`
- relevant `/docs/testing.md`

Implement ONLY Phase 8.

## Focus

Expected capabilities:

- report content
- moderation queue
- appropriate owner/admin/moderator actions
- remove member
- revoke access
- audit important moderation actions
- account deletion flow
- memory deletion flow
- batch deletion safeguards
- privacy controls
- data export/archive according to docs

## Export direction

Where supported, the archive should be understandable outside the app.

A future-friendly structure may include:
- media files
- memories metadata
- album metadata
- yearbook data

Follow the actual documented scope.

## Critical security test

After a member is removed, verify that the user can no longer access private batch data or media.

Run the full relevant test suite.

Update memory.md.

Report results and STOP.
