# Prompt 11 — Documentation Audit Before Coding

Read every file in `/docs`.

Do not implement application code.

Perform a senior architecture/product/security review of the documentation.

## Look for

- contradictions,
- missing requirements,
- duplicated requirements,
- unclear ownership,
- missing permissions,
- privacy gaps,
- weak RLS assumptions,
- storage-access risks,
- broken invite assumptions,
- poor deletion/export rules,
- database normalization issues,
- missing indexes,
- unnecessary complexity,
- missing mobile UX considerations,
- missing accessibility expectations,
- test gaps,
- phase dependencies that are out of order.

## Special focus

1. Private batch isolation
2. Batch membership
3. Owner/admin permissions
4. Invite revocation and expiration
5. Removed-member access
6. Media privacy
7. Storage costs
8. Large uploads
9. Account deletion
10. Batch deletion
11. Data export
12. Long-term preservation

## Action

You may update documentation files to fix clear contradictions or omissions.

Do NOT:
- start coding,
- create migrations,
- install dependencies.

After review provide:

- Readiness score from 0-100
- Blockers, if any
- Major risks
- Exact recommendation for whether Phase 0 may begin

Then STOP.
