# Prompt 12 — Implement Phase 0: Foundation

Read:

- `/docs/memory.md`
- `/docs/phases.md`
- `/docs/architecture.md`
- `/docs/rules.md`
- `/docs/design.md`
- `/docs/security.md`

Implement ONLY Phase 0 from `phases.md`.

Do not implement authentication flows or product features unless Phase 0 explicitly requires a minimal placeholder.

## Before coding

First output a short implementation plan containing:

1. files/directories to create,
2. packages to use,
3. environment variables required,
4. verification commands.

Then implement Phase 0.

## Expected areas

Depending on `phases.md`, this may include:

- Next.js + TypeScript base project
- Tailwind
- shadcn/ui setup
- Framer Motion
- Supabase clients/config
- environment templates
- base layouts
- design tokens
- reusable primitives
- linting
- type checking
- test framework
- migration directory
- CI-ready commands
- error boundary / base loading patterns

## Do not

- build login,
- build batch creation,
- create fake finished screens,
- add future-phase dependencies without need.

## Verification

Run the documented checks, including as applicable:

- type checking
- linting
- tests
- production build

Do not claim commands passed unless actually run.

Update `/docs/memory.md` after completing the phase.

Then provide:

- completed items,
- verification results,
- known issues,
- next phase,

and STOP.
