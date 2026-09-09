# BatchVault — Project Context

## 1. Product One-Liner
BatchVault is a private, collaborative digital time capsule for college batches to preserve and revisit their shared history together, for life.

## 2. Product Vision
A permanent, collaborative, digital home for a college batch's memories — one that a batch can return to years or decades later and instantly feel transported back to their college years, together with the same classmates who lived it.

## 3. Problem Statement
College memories today are scattered across WhatsApp groups, personal phone galleries, and cloud drives that decay, get deleted, or become impossible to search over time. There is no dedicated, private, permanent, collaborative space owned by a batch — as a batch — to preserve their shared history in a structured, meaningful way.

## 4. Core Value Proposition
BatchVault gives each college batch a private, invite-only space to collectively build and preserve a structured archive of their shared college life — photos, stories, events, and timelines — designed for long-term emotional return, not daily social consumption.

## 5. Primary Users
- Current college students who want to document their batch's journey as it happens.
- Graduating students preserving their final year and yearbook-style memories.
- Alumni (years after graduation) returning to relive and rediscover shared history with old classmates.

## 6. Primary Use Case
A batch (defined by institution, course, department, graduation year, and section) creates a private Batch Space, invites classmates, and collaboratively uploads and organizes memories — photos, videos, captions, stories, events, and albums — into a shared, chronological, collective archive that grows over the years they're together and remains preserved afterward.

## 7. Core Emotional Promise
A user can return 5, 10, or 20 years later and easily relive their college years with their classmates — as if opening a shared time capsule built together, not a personal photo dump.

## 8. MVP Loop
User signs up → creates a batch → shares an invite → classmates join → members upload memories → classmates react/comment → batch archive grows → members revisit memories later.

## 9. Product Principles
1. Privacy first.
2. Invite-only batches are the default.
3. Private batch content must be protected at the backend/database level.
4. Mobile-first experience.
5. Photography and memories are the visual focus.
6. Modern, emotional, youthful, premium UI.
7. Nostalgic details without making the interface look old-fashioned.
8. Maintainable architecture.
9. Accessible design.
10. Long-term preservation and export must be considered from the start.
11. Do not add unnecessary features.
12. Do not turn the product into Instagram, WhatsApp, TikTok, or a generic file manager.

## 10. Initial Technology Direction
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Supabase Auth
- PostgreSQL
- Supabase Storage (initially)
- PostgreSQL Row Level Security
- Vercel

This is a direction, not a final architectural commitment, and is not permission to begin implementation.

## 11. Non-Goals
- Not a generic social network.
- Not a general-purpose messaging app (not a WhatsApp/Instagram/TikTok replacement).
- Not a generic cloud file/drive manager.
- Not built for public, open, or discoverable content — batches are private and invite-only.
- Not optimized for daily social engagement or virality; optimized for long-term meaning and preservation.

## 12. Long-Term Direction
- Deep support for future-unlock time capsules and "On This Day" style nostalgic resurfacing.
- Rich digital yearbook experiences per batch and per graduation year.
- Strong long-term data preservation and export guarantees, so a batch's archive remains accessible even far in the future.
- Continued emphasis on privacy and member-level control as batches grow, age, and members' life circumstances change.
