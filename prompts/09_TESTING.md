# Prompt 09 — Testing Strategy

Read:

- `/docs/PRD.md`
- `/docs/architecture.md`
- `/docs/database.md`
- `/docs/security.md`
- `/docs/rules.md`
- `/docs/phases.md`

Your only job is to create:

`/docs/testing.md`

Do not write tests yet.

## testing.md must define

1. Testing philosophy
2. Unit-test scope
3. Integration-test scope
4. End-to-end-test scope
5. Database/RLS tests
6. Permission tests
7. Authentication tests
8. Invitation tests
9. Upload tests
10. Media-access tests
11. Comment/reaction tests
12. Moderation tests
13. Time-capsule tests
14. Export/deletion tests
15. Accessibility tests
16. Responsive tests
17. Performance tests
18. Error-state tests
19. Retry/failure tests
20. Production smoke tests

## Critical test cases

Explicitly define tests proving:

- a non-member cannot access a private batch,
- a non-member cannot access private media,
- a member of Batch A cannot access Batch B,
- a normal member cannot perform owner-only actions,
- expired/revoked invites do not work,
- removed members lose access,
- deleting a memory follows the documented deletion policy,
- upload failure does not create broken permanent records,
- RLS cannot be bypassed through normal client credentials.

## Quality gates

Define what must pass before a phase is considered complete.

At the end:

1. list the critical security tests,
2. list the minimum pre-merge quality gate,
3. then STOP.
