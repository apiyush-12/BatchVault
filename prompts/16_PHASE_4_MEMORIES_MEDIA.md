# Prompt 16 — Implement Phase 4: Memories & Media

Read:

- `/docs/memory.md`
- Phase 4 in `/docs/phases.md`
- relevant `/docs/PRD.md`
- `/docs/architecture.md`
- `/docs/database.md`
- `/docs/security.md`
- `/docs/rules.md`
- `/docs/design.md`
- relevant `/docs/testing.md`

Implement ONLY Phase 4.

## Focus

Expected capabilities:

- create memory
- photo upload
- constrained short-video upload if included in MVP
- multi-file behavior if included in Phase 4
- caption
- memory date
- optional event/category
- uploader ownership
- edit memory
- delete memory
- upload progress
- retry/failure UX
- media metadata
- private media access

## Security

Private media must not be publicly guessable/downloadable without authorization.

Validate:
- MIME/type
- file size
- ownership
- batch membership

Follow the documented EXIF/location policy.

Do not implement timeline, comments, or reactions unless explicitly listed in Phase 4.

## Reliability

Avoid orphaned DB records when upload fails.
Avoid orphaned storage objects when DB creation fails where practical.

Add regression tests.

Update memory.md.

Report:
- upload flow,
- storage rules,
- tests,
- limitations,
- next phase.

Then STOP.
