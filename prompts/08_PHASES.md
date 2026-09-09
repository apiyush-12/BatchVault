# Prompt 08 — Break Development into Small Phases

Read:

- `/docs/project-context.md`
- `/docs/PRD.md`
- `/docs/architecture.md`
- `/docs/database.md`
- `/docs/security.md`
- `/docs/rules.md`
- `/docs/design.md`

Your only job is to create:

`/docs/phases.md`

Do not implement anything.

## Goal

Break the product into small, sequential, testable development phases.

Do not make a phase so large that an AI coding agent must modify the entire application at once.

## Required MVP phase direction

Use approximately this progression, adjusting only when justified:

### Phase 0 — Foundation
Project setup, base UI, Supabase setup, environments, migrations framework, CI checks.

### Phase 1 — Authentication & Profile
Signup, login, logout, verification, password reset, profile onboarding, protected routes.

### Phase 2 — Batch Spaces & Membership
Create batch, batch identity, privacy, owner/member roles, settings basics.

### Phase 3 — Invitations & Join Flow
Invite codes/links, join flow, approval where needed, member list.

### Phase 4 — Memories & Media
Photo upload, constrained video upload, captions, dates/events, edit/delete, media reliability.

### Phase 5 — Gallery, Albums & Timeline
Memory feed/gallery, albums, filters, chronological timeline, memory details.

### Phase 6 — Social Layer
Comments, reactions, notifications, member profiles.

### Phase 7 — Time Capsules & Yearbook
Time capsule creation/contribution/unlock, yearbook entries and presentation.

### Phase 8 — Moderation, Privacy & Export
Reporting, moderation, audit log, account/batch controls, archive/export.

### Phase 9 — Quality & Production
E2E tests, accessibility, performance, security review, monitoring, deployment readiness.

## Every phase must include

- Objective
- Scope
- Explicit non-scope
- User stories
- Database changes
- Backend changes
- Frontend changes
- Security work
- Tests
- Acceptance criteria
- Definition of done
- Expected docs/memory updates

Do not include advanced AI features in the MVP phases.

At the end:

1. print the phase list only,
2. recommend which phase creates the first demoable experience,
3. then STOP.
