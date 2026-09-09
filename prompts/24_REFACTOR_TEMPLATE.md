# Reusable Prompt — Refactor Safely

Read:

- `/docs/memory.md`
- `/docs/architecture.md`
- `/docs/rules.md`
- relevant tests
- only the module being refactored

## Refactor target

[MODULE / FILES]

## Problem

[Why refactoring is needed]

## Rules

- Preserve behavior.
- Preserve public interfaces unless explicitly approved.
- Do not change the database schema unless required and approved.
- Do not weaken security.
- Do not add unrelated features.
- Keep the diff focused.
- Add/adjust tests before or alongside structural changes.
- Run tests, type checks, lint, and build as relevant.

If the refactor would require an architecture change, STOP and explain before proceeding.

Update memory.md only if a durable architectural decision changed.

Report results and STOP.
