# Prompt 03 — Create Architecture

Read:

- `/docs/project-context.md`
- `/docs/PRD.md`

Your only job is to create:

`/docs/architecture.md`

Do not implement code.
Do not create migrations.
Do not install packages.

## Architecture objective

Design the simplest production-quality architecture that can support the MVP without unnecessary microservices.

Use this stack unless there is a serious documented reason not to:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Supabase Auth
- PostgreSQL / Supabase Database
- Supabase Storage initially
- Row Level Security
- Vercel

## architecture.md must cover

1. High-level system diagram
2. Frontend architecture
3. Server-side responsibilities
4. Authentication flow
5. Authorization flow
6. Database access approach
7. Storage architecture
8. Media upload flow
9. Image thumbnail / optimization approach
10. Video upload constraints for MVP
11. Caching strategy
12. Notifications architecture
13. Background jobs / asynchronous processing
14. Logging and error reporting
15. Environment variable strategy
16. Folder and file structure
17. Feature/module boundaries
18. API/server-action conventions
19. Future scale path
20. Backup and recovery considerations
21. Architecture decision records / important decisions
22. Things intentionally postponed

## Architecture rules

- Do not create microservices for the MVP.
- Do not put authorization only in UI code.
- Do not expose service-role credentials to browsers.
- Do not let frontend components directly own complex database logic.
- Keep features modular.
- Use strict TypeScript.
- Prefer boring, dependable architecture over cleverness.

## Required folder direction

Use a feature-oriented structure around domains such as:

- authentication
- profiles
- batches
- memberships
- invitations
- memories
- media
- albums
- comments
- reactions
- notifications
- moderation
- time capsules
- yearbook

When complete:

1. give a short architecture summary,
2. list the 5 highest-risk architecture areas,
3. then STOP.

Do not create database.md yet.
