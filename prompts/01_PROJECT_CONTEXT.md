# Prompt 01 — Create Project Context

You are beginning a new production-grade product called **BatchVault**.

Your only job in this step is to create:

`/docs/project-context.md`

Do not create application code.
Do not create the database.
Do not install packages.
Do not implement UI.
Do not create other documentation files yet.

## Product idea

BatchVault is a collaborative digital memory platform for college students and alumni.

A college batch can have a private Batch Space based on:

- institution / college
- course
- department
- graduation year
- section

Example:

College: ABC University  
Course: B.Tech  
Department: Computer Science  
Graduation Year: 2027  
Section: A

Members of that batch can preserve their shared college history through:

- photos
- videos
- captions
- stories
- events
- albums
- chronological timelines
- comments
- reactions
- member profiles
- digital yearbook entries
- future-unlock time capsules
- throwbacks
- "On This Day" memories

The product is NOT meant to be another generic social network or cloud drive.

It should feel like:

> a permanent collaborative digital time capsule and historical home for a college batch.

The long-term emotional goal is that a user can return 5, 10, or 20 years later and easily relive their college years with their classmates.

## Important product principles

1. Privacy first.
2. Invite-only batches should be the default.
3. Private batch content must be protected at the backend/database level.
4. Mobile-first experience.
5. Photography and memories are the visual focus.
6. Modern, emotional, youthful, premium UI.
7. Nostalgic details without making the interface look old-fashioned.
8. Maintainable architecture.
9. Accessible design.
10. Long-term preservation and export should be considered.
11. Do not add unnecessary features.
12. Do not turn the product into Instagram, WhatsApp, TikTok, or a generic file manager.

## Primary MVP loop

User signs up  
→ creates a batch  
→ shares an invite  
→ classmates join  
→ members upload memories  
→ classmates react/comment  
→ batch archive grows  
→ members revisit memories later

## Initial technology direction

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Supabase Auth
- PostgreSQL
- Supabase Storage initially
- PostgreSQL Row Level Security
- Vercel

Do not treat this technology direction as permission to start coding.

## Your task

Create `/docs/project-context.md` containing:

1. Product one-liner
2. Product vision
3. Problem statement
4. Core value proposition
5. Primary users
6. Primary use case
7. Core emotional promise
8. MVP loop
9. Product principles
10. Initial technology direction
11. Non-goals
12. Long-term direction

Keep the document concise enough that future AI sessions can read it quickly.

After creating the file:

- show me a short summary,
- list no more than 5 assumptions you made,
- then STOP.

Do not create any other file in this step.
