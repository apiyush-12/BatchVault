# Prompt 04 — Design the Database

Read:

- `/docs/project-context.md`
- `/docs/PRD.md`
- `/docs/architecture.md`

Your only job is to create:

`/docs/database.md`

Do not run migrations yet.
Do not write application features.

## Goal

Design the PostgreSQL data model for BatchVault before implementation.

## Consider these entities

You may adjust names if needed, but evaluate at least:

- profiles
- institutions
- courses / departments
- batch_spaces
- batch_members
- batch_invites
- join_requests
- memories
- media_assets
- albums
- album_memories
- memory_tags or tagged_members
- comments
- reactions
- notifications
- reports
- time_capsules
- time_capsule_entries
- yearbook_entries
- audit_logs

## database.md must contain

1. Entity overview
2. Relationship diagram in text or Mermaid
3. Table definitions
4. Column names
5. Data types
6. Primary keys
7. Foreign keys
8. Unique constraints
9. Check constraints
10. Important indexes
11. Created/updated timestamps
12. Soft-delete vs hard-delete policy
13. Ownership fields
14. Batch scoping rules
15. Membership role representation
16. Invite representation
17. Media metadata
18. Reaction uniqueness rules
19. Comment threading decision
20. Notification representation
21. Audit-log strategy
22. Time-capsule locking/unlock model
23. Yearbook data model
24. Data retention considerations
25. Data export considerations

## Important database principle

Every private resource must be traceable to the batch it belongs to whenever practical.

Avoid designs that make authorization unnecessarily difficult.

## Do not

- use JSON for everything,
- duplicate the same relationship in multiple incompatible ways,
- invent dozens of tables without a reason,
- use database triggers for business logic unless clearly justified,
- add AI-specific tables yet.

At the end:

1. list the core tables,
2. list the most important indexes,
3. list any unresolved schema questions,
4. then STOP.

Do not create security.md yet.
