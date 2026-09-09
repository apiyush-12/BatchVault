# Prompt 06 — Create AI/Coding Rules

Read:

- `/docs/project-context.md`
- `/docs/PRD.md`
- `/docs/architecture.md`
- `/docs/database.md`
- `/docs/security.md`

Your only job is to create:

`/docs/rules.md`

Do not write application code.

This document will control future AI coding sessions.

## rules.md must define

### Technology rules
- TypeScript
- strict typing
- Next.js conventions
- Supabase conventions
- migration conventions
- component conventions
- validation conventions

### What to use
Define approved approaches and libraries.

### What to avoid
Include at least:

- unnecessary dependencies
- `any` without strong reason
- duplicated business logic
- secrets in client code
- service-role keys in browser code
- disabling RLS
- bypassing authorization to "fix" errors
- giant components
- giant utility files
- unrelated refactors during feature tasks
- changing architecture without updating docs
- claiming tests passed when they were not run

### Code organization
Define:
- feature boundaries
- reusable components
- data-access location
- server/client component guidance
- naming conventions
- import conventions

### Error handling
Define:
- user-safe errors
- developer logs
- retry states
- upload failure behavior
- destructive-action confirmation

### AI boundaries
Future coding agents must:
- implement only the requested phase,
- stop when instructed,
- read memory.md,
- update memory.md after meaningful work,
- never silently change core architecture,
- never invent completed tests,
- never add future-phase features "while already here."

### Quality rules
Include:
- accessibility
- responsive design
- tests
- linting
- type checks
- production build
- documentation

At the end:

1. print the 15 most important rules,
2. then STOP.

Do not create design.md yet.
