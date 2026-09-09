# BatchVault AI Build Prompt Pack

## Purpose

Use these prompts **one at a time** with your AI coding platform.

Do **not** paste the whole pack into one chat.

The workflow is intentionally split into small jobs so the AI:
- stays focused,
- does not invent unrelated features,
- does not rewrite the whole project,
- remembers architectural decisions,
- tests each phase,
- and stops after each requested task.

## How to use

1. Start with `01_PROJECT_CONTEXT.md`.
2. Wait for the AI to finish.
3. Review what it created.
4. Continue with the next numbered file.
5. Never skip directly to feature coding before the documentation steps are complete.
6. When a prompt says **STOP**, do not ask the AI to continue in the same message.
7. Fix serious issues before moving to the next numbered step.
8. Keep all generated documentation inside `/docs`.

## Target docs

By the end of the planning sequence the repository should contain:

```text
/docs/
  project-context.md
  PRD.md
  architecture.md
  database.md
  security.md
  rules.md
  design.md
  phases.md
  testing.md
  memory.md
```

## Recommended stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Supabase Auth
- PostgreSQL / Supabase Database
- Supabase Storage initially
- PostgreSQL Row Level Security
- Vercel

## Core rule

Private batch data must never be accessible to a person who is not authorized to access that batch.

## Build order

### Documentation
01 → Project Context  
02 → PRD  
03 → Architecture  
04 → Database  
05 → Security  
06 → Rules  
07 → Design  
08 → Development Phases  
09 → Testing Strategy  
10 → Memory File  
11 → Documentation Audit

### MVP Implementation
12 → Foundation  
13 → Authentication & Profile  
14 → Batch Spaces & Membership  
15 → Invites & Join Flow  
16 → Memories & Media Upload  
17 → Gallery, Albums & Timeline  
18 → Social Layer  
19 → Time Capsules & Yearbook  
20 → Moderation, Privacy & Export  
21 → Quality & Production Readiness

### Reusable maintenance prompts
22 → Bug Fix  
23 → UI Polish  
24 → Refactor  
25 → Pre-release Review

Do not build AI features until the normal product works well for real users.
