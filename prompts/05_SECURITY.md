# Prompt 05 — Security and Privacy Model

Read:

- `/docs/project-context.md`
- `/docs/PRD.md`
- `/docs/architecture.md`
- `/docs/database.md`

Your only job is to create:

`/docs/security.md`

Do not implement policies yet.
Do not write application code.

## Highest-priority rule

A person must never be able to read private batch data unless that person is authorized to access the batch.

UI hiding alone is not authorization.

## security.md must cover

1. Threat model
2. Authentication assumptions
3. Authorization model
4. Batch role permissions
5. Row Level Security strategy
6. Storage bucket/path strategy
7. Private media access
8. Signed URL policy if used
9. Invite-link security
10. Join-request security
11. Owner/admin privilege boundaries
12. Service-role key protection
13. Input validation
14. File upload validation
15. Allowed media types
16. File-size limits
17. Rate limiting
18. Abuse reporting
19. Moderation
20. Audit logs
21. Sensitive logging rules
22. Account deletion
23. Memory deletion
24. Batch deletion
25. Data export
26. Backup access
27. EXIF / location metadata policy
28. CSRF/XSS/SQL-injection considerations
29. Security headers
30. Dependency/security update policy

## Privacy direction

Invite-only should be the default.

Public showcase content, if supported later, must be explicitly chosen and must never accidentally expose private batch content.

Automatic facial recognition must not be part of the product.

Consider stripping unnecessary GPS metadata from uploaded media unless intentionally preserved.

## RLS documentation

Describe expected RLS behavior for major tables using human-readable rules.

Do not write the actual SQL policies yet.

At the end:

1. provide the top 10 security rules,
2. identify any security blocker,
3. then STOP.

Do not create rules.md yet.
