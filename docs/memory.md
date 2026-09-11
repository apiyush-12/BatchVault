# BatchVault Project Memory

*This is a concise handoff for future AI coding sessions — not a replacement for the source documents. If anything here conflicts with `project-context.md`, `PRD.md`, `architecture.md`, `database.md`, `security.md`, `rules.md`, `design.md`, `phases.md`, or `testing.md`, **those documents win**, and this file is wrong and must be corrected to match them.*

## Product Purpose

BatchVault is a private, collaborative digital memory / time-capsule home for a college batch (institution + course + department + graduation year + section). Members collectively build a shared, chronological archive of photos, videos, captions, stories, and events, designed for long-term revisiting — not daily social consumption.

Core MVP loop: signup → onboarding/profile → create batch → invite classmates → join/request approval → upload memories/media → gallery/timeline/detail → comments/reactions → moderation/privacy → production readiness.

The product **is**: privacy-first, invite-only by default, batch-scoped, mobile-first, photography/memory-first, modern/emotional/youthful/premium, nostalgic without looking old, built for long-term preservation and revisiting.

The product is **not**: a generic social network, an Instagram/TikTok/WhatsApp clone, a public directory, a cloud-drive replacement, a dating product, or an engagement-maximization feed.

## Current Phase

**Documentation planning complete and audited; implementation not started.** Documentation Prompts 01–11 are complete, including the Prompt 11 documentation audit. No application code, migrations, or product tables exist. No MVP feature phase has started. **Current implementation phase: NONE.**

## Completed

Planning documents, all committed:

1. `project-context.md`
2. `PRD.md`
3. `architecture.md`
4. `database.md`
5. `security.md`
6. `rules.md`
7. `design.md`
8. `phases.md`
9. `testing.md`
10. `memory.md` — this file
11. **Prompt 11 documentation audit — complete.** See Audit Record below.

## Current Work

No implementation work is in progress, and none has ever started. The next allowed task is **Phase 0 / Prompt 12**, on explicit instruction.

## Audit Record (Prompt 11)

The audit reconciled the documentation set before implementation. Summary of what changed — concise by design, not a file-by-file changelog:

- **Locked stack made unambiguous.** `project-context.md` §10 still framed the stack as "a direction, not a final architectural commitment" and omitted pnpm, Vitest, Playwright, Lucide React, React Hook Form and Zod — which `rules.md` had since locked. A Phase 0 agent could have read that as license to pick npm/Jest. Now reconciled; the stack itself was **not** changed.
- **A missing controlled write path was specified.** `onboarding_completed_at` was protected from ordinary DML with no documented way for onboarding to legitimately complete — an implementation blocker for Phase 1. `security.md` §5.4.3 now defines narrow controlled system-field write paths, explicitly distinct from the fixed high-risk RPC-only list, with no function names invented.
- **Author self-delete reconciled with the still-open PRD #7.** `security.md` §23 had asserted author self-delete as settled; it is now correctly conditional, and wherever it is eventually permitted it runs through the controlled path rather than a direct `deleted_at` write. Comment self-delete is treated **separately** from memories and is not in MVP phase scope.
- **Authorization-boundary language made consistent.** `architecture.md` §5/ADR-03 carried the pre-`security.md` absolute "RLS is the guarantee" framing; it now states the three-form model (RLS + column-level; Storage RLS; a privileged function's own checks).
- **Q4 kept genuinely open.** `design.md` wording that assumed generated derivatives ("a distinct, generated derivative", "the full derivative") is now neutral between Q4's two options.
- **Prompt-pack drift documented.** The conflicts in prompts 17, 18 and 20 are in their **bodies**, not just filenames (17 lists albums as expected capabilities; 18 lists "basic notifications"; 20 sketches an export archive containing album/yearbook data while Q9 is open). `phases.md` now records this; the prompt files were not modified.
- **Two stale/missing register entries fixed.** PRD unresolved #4 was in fact settled by `security.md` §10 (invite-link entry only; batches are not discoverable) and is now recorded as resolved; PRD #8 was missing from the gate register and is now tracked as non-blocking.

No product, architecture, database, or security decision was invented, and no open decision was silently resolved.

## Locked Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui (vendored) · Framer Motion · React Hook Form · Zod · Supabase Auth · Supabase Postgres · Supabase Storage · PostgreSQL RLS · Vitest · Playwright · Lucide React · Vercel · pnpm · Git/GitHub.

No alternative stack choice (a second test framework, a second package manager, a second UI/icon/form/validation library, etc.) is introduced without updating `architecture.md`/`rules.md` first.

## Core Architecture Decisions

- One Next.js app + Supabase (Auth, Postgres, Storage). No microservices.
- React Server Components by default; a Client Component only where interactivity/browser APIs/motion require it.
- Server Actions are the default write surface; Route Handlers only for cron, webhooks, and media routes that must stream bytes/set headers.
- Two Supabase clients: **user-scoped** (ordinary reads/writes, RLS-constrained) and **service-role** (server-only, narrow audited call sites — never in browser-reachable code, never `NEXT_PUBLIC_*`).
- Fixed order in every Server Action/Route Handler: authenticate → validate (Zod) → authorize → execute → revalidate.
- Batch-scoped private data carries `batch_id` directly on every table; composite same-batch foreign keys make cross-batch references structurally unrepresentable.
- Media: two-phase upload (preallocate → direct-to-Storage → finalize); server-generated/preallocated paths only — the client never chooses a path.
- Object-first deletion everywhere: the Storage object is deleted/confirmed-absent **before** its row is hard-deleted.
- Audit logs are append-only (no client `UPDATE`/`DELETE` grant).
- No facial recognition, ever — permanently excluded, not deferred.

## Security Invariants

- **RLS is enabled and `FORCE ROW LEVEL SECURITY` from the migration that creates every table.** No table ships without it, ever.
- Direct table access authorization = RLS (which row) **+** column-level enforcement (which fields) — row policy alone is never sufficient on a writable table.
- **Storage RLS is the media authorization boundary**, and must reflect memory/media *state* (soft-deleted, moderated, pending, rejected) — not membership alone.
- High-risk writes are **RPC-only** (list below). Inside a privileged RPC, the function's own explicit authorization logic — not RLS — is the boundary, because its execution role intentionally holds privileges the caller lacks.
- **Never weaken RLS, authorization, or a privileged RPC's checks to make an error go away or a task easier.** Zero exceptions.
- The caller is always derived from `auth.uid()`. Never trust a client-supplied identity, role, batch-ownership claim, or storage path.
- Private Storage buckets only. No public bucket, ever.
- Raw invite tokens are **never stored** (only a SHA-256 hash) and must never appear in a URL path/query string or any logging position — they travel in the URL fragment, POSTed to redemption.
- Signed URLs follow the adopted **Option B** model (`security.md` §8.1): a member who already holds Storage `SELECT` access can mint their own signed URL directly; the app's TTL and rate limits bound only the app's own minting path, never a client-minted URL.
- Column-level forgery (`batch_id`, author/profile id, deletion fields) must be rejected at the database, never merely hidden in the UI.
- A protected system field still needs a **narrow controlled write path** (one field, own row, server-set value, database-enforced precondition, no other column exposed — `security.md` §5.4.3). This is **separate from** the high-risk RPC-only list and is never solved by making the field client-writable.
- **Batches are not discoverable.** No search, no directory, no endpoint confirming a batch exists from its id; entry is by invite link only (`security.md` §10).

## High-Risk RPC-Only Operations

Client roles hold no direct `INSERT`/`UPDATE`/`DELETE` for:

- batch creation + initial owner membership
- invite creation
- invite redemption / membership creation
- membership approval / rejection / removal
- role changes
- ownership transfer
- media preallocation
- media finalize
- report creation
- audit-log insertion
- batch deletion / restoration

Final SQL function names and signatures are an implementation decision — not fixed by any doc. Do not invent or assume them.

## Database Summary

MVP tables planned (**none implemented yet**): `profiles`, `batches`, `batch_members`, `batch_invites`, `memories`, `media_assets`, `comments`, `reactions`, `reports`, `audit_logs`.

Key schema ideas to remember:

- At most one active owner per batch (partial unique index).
- Join/membership state lives entirely in `batch_members.status` — no separate join-request table.
- One reaction per member per memory, not a like-counter.
- Comments are flat — no threading in MVP.
- Reports carry an immutable snapshot plus a nullable live reference; a report never blocks deletion of its target.
- Media uses two-phase state: `pending` → `ready` | `rejected`.
- Soft deletion is used for preservation-sensitive content (memories, media, comments, batches); hard delete only via a later, object-first, retention-window sweep.
- Invite: token hash only — the raw token is never stored.

Post-MVP tables (`albums`, `album_memories`, **`memory_people`** — manual people tagging, never facial recognition — `notifications`, `time_capsules`, `time_capsule_entries`, `yearbook_entries`, `institutions`, `courses`) are designed in `database.md` but **not created**.

## Important Paths

- `/docs/` — all planning documents (this file plus the nine listed under Completed).
- `/prompts/` — the prompt pack; sequencing hints only, never scope authority over the docs.
- Expected source layout once implementation starts (architecture §16): `app/` (routing/composition only), `features/<domain>/` (`actions.ts`/`queries.ts`/`schema.ts`/`types.ts`/`permissions.ts`/`components/`), `components/ui` + `components/motion`, `lib/supabase`, `lib/auth`, `lib/authz`, `lib/env`, `lib/logging`, `lib/validation`, `types/`, `supabase/` (migrations, added later).

## Phase Plan

Per `phases.md`, all phases currently **not started**:

- Phase 0 — Foundation
- Phase 1 — Authentication & Profile
- Phase 2 — Batch Spaces
- Phase 3A — Invitations & Join
- Phase 3B — Membership Decisions & Roles
- Phase 4A — Photo Upload Pipeline
- Phase 4B — Video Constraints, Edit/Delete & Media Reliability
- Phase 5A — Gallery & Memory Detail
- Phase 5B — Timeline & Event Grouping
- Phase 6 — Comments & Reactions
- Phase 7 — no MVP scope (time capsules and yearbook are post-MVP)
- Phase 8A — Reporting, Moderation & Audit Visibility
- Phase 8B — Batch & Account Lifecycle (gated — see Known Issues below)
- Phase 9 — Quality & Production Readiness

**Current implementation phase: NONE** — documentation planning and the Prompt 11 audit are complete; Phase 0 has not begun.

## Post-MVP Boundaries

Not designed further, and not implemented in any MVP phase: **albums, notifications, time capsules, yearbook, public showcase, advanced search/discovery, richer media processing/transcoding, AI features.**

Prompt-pack conflicts — **documentation wins over the prompt files** (`phases.md`, "Prompt-Pack Mapping and Conflicts"). The Prompt 11 audit confirmed these conflicts are in the prompt **bodies**, not only their filenames:

- **Prompt 17** — its body lists "albums" and "add/remove memories from albums" as expected capabilities. Albums remain post-MVP; build gallery/timeline/detail only, and create no album table or UI.
- **Prompt 18** — its body lists "basic notifications" and "notification privacy". Notifications remain postponed; build comments/reactions only.
- **Prompt 19** — its body is a full capsule/yearbook build brief. Phase 7 has no MVP scope; decline the build and cite `phases.md` Phase 7.
- **Prompt 20** — its body sketches an export archive including album and yearbook data while Q9/R10 is still open. No export surface ships until Q9 is decided, and post-MVP data cannot appear in one.
- **Prompt 12** — its body asks for "packages to use" and names "test framework" as an expected area without listing them. These are **not** open choices; the stack is locked (above).

## Known Issues / Open Decisions

None of these is decided in any doc yet. **Do not resolve any of them silently** — a resolution updates its authoritative source document first, then this file.

Classified by the Prompt 11 audit. The classification matters: **nothing blocks Phase 0 entry.**

**A — Blocks Phase 0 entry: NONE.**

**B — Must be resolved *during* Phase 0**
- **B2** — the `SECURITY DEFINER` / `FORCE RLS` / function-owner execution model must be **verified in the real Supabase environment**. Phase 0 is where this gets proven; it then **blocks Phase 2** and every later privileged-RPC/membership-helper policy until recorded.

**C — Blocks a later implementation phase**
- **Q1** — `join_policy` default and whether it's owner-configurable → Phase 2 / 3A.
- **B1** — EXIF/GPS handling → must be decided before Phase 4A (two of the four options change the upload pipeline); also a release blocker (D).
- **Q4** — image derivative strategy (Storage transformations vs. generated derivatives) → Phase 4A.
- **R1** — signed-URL TTL value → Phase 4A.
- **R2** — private-media-vs-image-optimizer delivery design → Phase 4A, re-verified 5A.
- **R6** — HEIC product behavior → Phase 4A UX, revisited Phase 9.
- **Q5** — stated vs. defaulted `occurred_on`, if ever needed → Phase 4A/5B (may resolve as "no change").
- **PRD #7** — member memory edit/delete rights and any time limit → Phase 4B.
- **Q2** — reaction `kind` allowlist → Phase 6.
- **PRD #5** — retention policy for removed/reported content → Phase 8A.
- **PRD #6** — batch-deletion mechanics (immediate vs. grace period) → Phase 8B.
- **B3 / Q3** — owner-account-deletion behavior (block-pending-transfer / auto-promote / claimable-ownerless) → Phase 8B; the account-deletion flow must not ship without it.
- **Q7** — audit rows after batch hard-delete (`batch_id` becomes `NULL`) → Phase 8B.
- **Q9 / R10** — export scope and format → Phase 8B; until decided, **no export surface ships**.
- **R3** — whether re-authentication is added before destructive actions → Phase 8B.

**D — Release blockers**
- **B1** — EXIF/GPS handling must be implemented/closed before release (also C).
- **B4** — platform-level moderation path for a hostile owner / illegal content; a missing capability, not yet designed.
- **R9** — actual Supabase Storage response headers must be verified before release.
- **R4** — account deletion does not delete contributions: honest user-facing wording plus legal review.

**E — Accepted / tracked risks (no gate)**
- **R5** — audit trail loses actor identity on account deletion (action/time/frozen role survive).
- **R7** — no per-batch storage quotas.
- **R8** — backups sit outside every control in `security.md`; organizational mitigation.
- **Q6** — counter columns; **Q10** — UUIDv7 — both revisit-if-needed only.
- **PRD #8** — distinguishing separate sections/years of the "same" institution; invisible in MVP because batches are never listed side by side.

**F — Post-MVP open decisions**
- **Q8** — whether a sealed time capsule's existence is visible before unlock.

**Recently settled (do not reopen):** PRD #4 — entry is by **invite link only** and batches are not discoverable (`security.md` §10).

## Testing & Quality Rules

- Vitest: unit, integration, and database/RLS/RPC/Storage tests.
- Playwright: E2E, browser, and accessibility/reduced-motion flows.
- Security-sensitive tests call PostgREST/Storage **directly**, not only through the app.
- Adversarial/negative tests are mandatory wherever a table, policy, RPC, or Storage path is touched.
- Applicable phase gates (lint, typecheck, Vitest, Playwright, build, `pnpm audit`, adversarial suite, a11y) must be **actually executed and observed** — never claimed as passing because they're configured or "should" pass.
- pnpm is the only package manager.

## Do Not Change Without Explicit Decision

- The locked stack (above).
- RLS-as-authorization-boundary and the RPC-only write list (above).
- The 10 MVP tables and their key invariants (above).
- The phase order and post-MVP boundaries (above).
- Any open decision/blocker (above) — resolving one updates its **source document** first, never this file alone.

## Next Task

**Phase 0 / Prompt 12 — Foundation**, on explicit instruction. The Prompt 11 audit is complete and Phase 0 is cleared to begin; no open decision blocks entry. **B2 must be verified during Phase 0** and then blocks Phase 2 until recorded.

## Update Rules

After each meaningful implementation phase or sub-phase, update this file to record **only**:

1. Current phase/status.
2. What was actually implemented.
3. New durable decisions that were intentionally made.
4. Database migrations/RPCs/policies/Storage changes introduced.
5. Tests/gates that were **actually executed**, and their result.
6. Known bugs/blockers/open decisions.
7. The exact next allowed task.

Do **not** turn this file into: a changelog of every file edited, a transcript of conversations, a duplicate of the architecture/database/security/testing docs, or a place to silently introduce a new decision. **If a durable design decision changes, update its authoritative source document first — then update this file to match.**

## AI Session Rules

Every future session must:

- Read `CLAUDE.md`.
- Read this file (`docs/memory.md`).
- Read the prompt explicitly requested, and every source document that prompt requires.
- Perform only that task — implement only the requested phase; never start a later phase "while already here."
- Never use a worktree; keep one writer at a time.
- Stop exactly when told to STOP.
- Update `docs/memory.md` when an implementation prompt requires it (per Update Rules above).
- Never weaken privacy, authorization, RLS, Storage security, or a privileged RPC's checks.
- Never claim a test, lint run, typecheck, or build passed unless it was actually executed in that session and its output observed.

---

STOP — Prompts 01–11 complete (documentation planning and audit). Implementation has **not** started. **Next Task: Phase 0 / Prompt 12 — Foundation**, on explicit instruction.
