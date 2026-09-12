# BatchVault Project Memory

*This is a concise handoff for future AI coding sessions — not a replacement for the source documents. If anything here conflicts with `project-context.md`, `PRD.md`, `architecture.md`, `database.md`, `security.md`, `rules.md`, `design.md`, `phases.md`, or `testing.md`, **those documents win**, and this file is wrong and must be corrected to match them.*

## Product Purpose

BatchVault is a private, collaborative digital memory / time-capsule home for a college batch (institution + course + department + graduation year + section). Members collectively build a shared, chronological archive of photos, videos, captions, stories, and events, designed for long-term revisiting — not daily social consumption.

Core MVP loop: signup → onboarding/profile → create batch → invite classmates → join/request approval → upload memories/media → gallery/timeline/detail → comments/reactions → moderation/privacy → production readiness.

The product **is**: privacy-first, invite-only by default, batch-scoped, mobile-first, photography/memory-first, modern/emotional/youthful/premium, nostalgic without looking old, built for long-term preservation and revisiting.

The product is **not**: a generic social network, an Instagram/TikTok/WhatsApp clone, a public directory, a cloud-drive replacement, a dating product, or an engagement-maximization feed.

## Current Phase

**Phase 0 — Foundation: IN PROGRESS (not complete).** Documentation Prompts 01–11 are complete, including the Prompt 11 audit. The Phase 0 repository, toolchain, environment boundary, Supabase client boundaries, migration framework, private Storage buckets, test harnesses and CI are in place.

**B2 is now CLOSED.** On 2026-09-12 the execution model was verified empirically against a **real hosted, non-production Supabase project** (`BatchVault-Dev`, ref `idmpwblennrdpasfnbyw`, PostgreSQL 17.6, `ap-southeast-1`) across two transports — direct SQL and the production PostgREST surface with a real Supabase Auth JWT. Full results, and the distinction between the earlier reconstructed findings and the real ones, are in `security.md` §32 "B2 verification status". The Supabase-dependent checks that had never run — migrations applied through the CLI, and Storage bucket privacy — were also executed against that project and passed.

**The committed DB gate now also passes against the hosted project.** `pnpm test:db` → **26 passed, 0 failed, 0 skipped, 3 files**, harness reporting `kind: "supabase"`, `ownerRole: "postgres"`, PostgreSQL 17.6. B6 and B5 are both closed (below).

**What remains before Phase 0 can be declared COMPLETE:** only the **git checkpoint** — `phases.md` Phase 0 Definition of Done includes "One commit: `chore: phase 0 foundation` … made only after gates pass", and nothing has been committed. A first green CI run follows naturally from that commit.

A prior session over-stated two items as hard Phase 0 blockers; on review of `phases.md`, `testing.md` §1/§6 and `rules.md` §7 they are **not**:

- *"CI must have executed"* — `testing.md` §1 defines **Executed** as "actually ran in a real session (**local or CI**)", and `testing.md` §6 (explicitly aligned with `phases.md`'s gate table and `rules.md` §7) names **no CI-execution gate**. `phases.md`'s own Git checkpoint puts the commit *after* gates pass, so requiring a green CI run first would be circular.
- *"three environments must physically exist"* — `phases.md` says separate projects for **local / preview / production** and architecture §15 frames this as **per-environment isolation** with secrets in *Vercel project settings*. Phase 0 has no deployment scope; "production deployment readiness" is **Phase 9**. The Phase 0 criterion is the resolution/isolation mechanism, which the split typed env module already provides.

No product table exists on the hosted project (verified: 0 tables in `public`). No auth flow, no feature module, and no product screen exists.

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

**Phase 0 / Prompt 12 — Foundation, in progress.**

What exists now (nothing here is a product feature):

- **App**: Next.js 16 App Router, React 19, strict TypeScript (`strict`, `noUncheckedIndexedAccess`), Tailwind CSS v4, ESLint. One placeholder page proving the shell boots — deliberately not a dashboard or a landing page.
- **Structure** per architecture §16: `app/` (thin; route groups reserved, no product routes), `features/<domain>/` boundary notes for the ten MVP domains, **empty reserved boundaries** for `albums`, `notifications`, `time-capsules`, `yearbook`, plus `components/ui`, `components/motion`, `components/theme`, `components/a11y`, `lib/{env,supabase,auth,authz,logging,validation}`, `types/`, `supabase/`.
- **Environment boundary** (`lib/env`): pure Zod schemas plus split `client.ts` / `server.ts`; the server module is `server-only`. It refuses a service-role-shaped credential in the client key slot, refuses any `NEXT_PUBLIC_*` secret, and reports failures by variable **name** only. ESLint forbids `process.env` outside `lib/env`, config and tests.
- **Supabase clients**: browser user-scoped, server user-scoped (cookie-bound), and a `server-only` service-role client with **zero call sites** and its allowlist documented in place.
- **UI foundation**: shadcn/ui infrastructure (`components.json`) with one vendored primitive (`Button`), Lucide React, Framer Motion behind shared `components/motion` wrappers that resolve `prefers-reduced-motion` **once**, design tokens for design.md §4–9 in `app/globals.css`, light/dark with **system as default and no blocking inline script**, a visible focus ring, and skip-to-content.
- **Database**: Supabase CLI config plus three migrations — the shared `set_updated_at()` housekeeping function, the two **private** Storage buckets, and the forward migration revoking `EXECUTE` on the housekeeping function from `PUBLIC` and each named client role (B5). **No product table.** No Storage policy (deny-by-default is the correct Phase 0 posture).
- **Tests**: Vitest in three projects (`unit`, `db`, `artifacts`) and Playwright (mobile + desktop). Includes the B2 experiment, foundation-migration tests, a Storage-privacy suite, a client-artifact secret scan, and a11y/reduced-motion/theme E2E.
- **CI**: `.github/workflows/ci.yml` with both gate sets. **Configured, never executed** — no commit or push has been made.

### Gates executed 2026-09-12 against the hosted project (real output observed)

Run with `corepack pnpm` (pnpm is not on PATH in that environment; a Corepack shim was used for Playwright's `webServer`, which invokes `pnpm`).

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | **PASS** |
| Typecheck | `pnpm typecheck` | **PASS** |
| Unit tests | `pnpm test:unit` | **PASS** — 22 tests |
| Production build | `pnpm build` | **PASS** |
| Client artifact scan | `pnpm test:artifacts` | **PASS** — 3 tests, run three ways: fresh bundle; with a service-role-shaped **canary** configured (0 occurrences in client output); and with the **real** service-role key from `.env.local` visible to the test (0 occurrences anywhere in `.next`). Grep mechanism proven functional by positive control. **Caveat, recorded deliberately:** `lib/supabase/client.ts` has **zero call sites**, so no `NEXT_PUBLIC_*` value is inlined and the client bundle is nearly empty — this gate is not yet stressed and only becomes load-bearing in Phase 1, when the browser client is first imported by a page |
| Playwright | `pnpm test:e2e` | **PASS** — 16 tests (2 projects). One cold-start flake on the first attempt immediately after installing the browser (a11y scan hit the 30 s timeout); clean on re-run |
| Dependency audit | `pnpm audit --prod --audit-level high` | **PASS** — no known vulnerabilities |
| Hosted migration apply | `supabase db push --linked` | **PASS** — both migrations applied; `supabase migration list --linked` shows local == remote |
| Hosted foundation verification | Management API SQL | **PASS** — 0 tables in `public`; `set_updated_at` the only `public` function (`prosecdef=false`); no policies anywhere outside catalogs |
| Hosted Storage privacy | Management API SQL + real HTTP | **PASS** — both buckets exist and are `public=false`; no public bucket; no `showcase` bucket; 0 policies on `storage.objects`; RLS enabled on `storage.objects`. Anonymous HTTP: public-object endpoint **400**, object read **400**, upload **400** (nothing persisted), object list `[]`, bucket list `[]` |
| **B2 execution model (hosted)** | Management API SQL + production PostgREST with a real Auth JWT | **PASS** — 22 direct-SQL findings + 13 PostgREST findings. **B2 closed**; see `security.md` §32 |
| **Committed DB suite (hosted)** | `corepack pnpm test:db` | **PASS — 26 passed, 0 failed, 0 skipped, 3 files.** `kind: "supabase"`, `ownerRole: "postgres"`, PostgreSQL 17.6. Its `ownerIsRlsExempt()` branch took the *exempt* path, independently reproducing the `BYPASSRLS` finding |
| CI | GitHub Actions | **NOT EXECUTED** — configured only; nothing has been committed |

Earlier session, still true: two real defects were found and fixed by these gates rather than worked around — a `setState`-in-effect in the theme provider (replaced with `useSyncExternalStore`), and an axe contrast failure caused by scanning a half-faded entrance animation (the scan now waits for the settled UI).

### Disposable probe hygiene (2026-09-12)

Every B2 probe object was disposable and removed; removal was verified by query: `b2_probe_hosted` schema **dropped**, `b2_probe_owner` role **dropped**, all `public.b2p_*` functions and the `b2p_rows` table **dropped**, the disposable Auth user **deleted** (`auth.users` count = 0), 0 policies outside catalogs, 0 tables in `public`, `set_updated_at` the only `public` function. No permissive policy, debug function, test identity or experimental schema was left behind, and no existing security configuration was weakened to make anything pass.

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
- **Every migration must `REVOKE` from the named client roles — `anon`, `authenticated`, `service_role` — never from `PUBLIC`.** Verified 2026-09-12: hosted Supabase's default privileges grant those roles full DML on new `public` tables and `EXECUTE` on new functions, and a `PUBLIC` revoke does not touch them (B5). Assert the resulting ACL in a test; do not assume it.
- **A `SECURITY DEFINER` function owned by `postgres` bypasses RLS entirely** (verified: `postgres` holds `BYPASSRLS`, which beats `FORCE ROW LEVEL SECURITY`). Inside one, its own explicit `auth.uid()`-based checks are the *only* boundary — including a mandatory NULL branch, because `auth.uid()` is `NULL` for an anonymous caller. Never write owner-admitting policies; they are inert here.
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

Per `phases.md`, Phase 0 is **in progress**; every later phase is **not started**:

- Phase 0 — Foundation — **IN PROGRESS**
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

**Current implementation phase: Phase 0, in progress** — the foundation is built, **every runnable gate has been executed and passes** (including `pnpm test:db` at 26/26 against real Supabase), the hosted migration and Storage-privacy checks pass, and **B2, B5 and B6 are all closed**. The only outstanding Phase 0 item is the **git checkpoint**, which the working sessions were instructed not to make.

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

- **B2 — ✅ RESOLVED 2026-09-12.** Verified against the real hosted project across two transports (direct SQL + production PostgREST with a real Supabase Auth JWT). Full results in `security.md` §32 "B2 verification status", which keeps the earlier reconstructed findings and the real ones clearly separated. **The decisive facts:**
  - Supabase's `postgres` (which owns migrated objects) is **not** a superuser but **holds `BYPASSRLS`**. `anon`, `authenticated` and `authenticator` hold neither attribute, so no client role can ever bypass RLS.
  - **`BYPASSRLS` beats `FORCE ROW LEVEL SECURITY`**, so a `SECURITY DEFINER` function owned by `postgres` **does** bypass RLS — the definer read 2/2 rows of a forced table whose policy admits 1, on both transports. This **supersedes** the reconstructed conclusion that definer alone is insufficient: that behaviour was real PostgreSQL behaviour for a non-exempt owner (re-proven here with a disposable non-`BYPASSRLS` owner: 0 rows, `42501`), but it is not Supabase's. **Do not write owner-admitting policies — they would be inert and would widen every policy they appear in.**
  - Consequently a privileged RPC's own checks are **the only** boundary for its writes. Confirmed the hard way: removing a function's `auth.uid()` check let an unauthorized caller write.
  - `auth.uid()` is preserved into a definer function as the JWT caller (`current_user=postgres`, `session_user=authenticator`); for an anonymous caller it is **`NULL`**, so the NULL branch is mandatory. **Never read `session_user` to infer the caller** — it is always `authenticator` over PostgREST.
  - Forged actor/role parameters were ignored. Recursion reproduced: invoker helper in a self-referential policy → `54001`; definer helper → clean, own row only. The parameterised helper variant **leaked another user's membership**, confirming why §5.3 forbids the parameter.
- **B5 — ✅ RESOLVED 2026-09-12.** Hosted Supabase's `ALTER DEFAULT PRIVILEGES` (24 `pg_default_acl` rows) grants `anon`, `authenticated` and `service_role` **full table DML (`arwdDxtm`)** on every new table in `public`, **`EXECUTE`** on every new function, and `rwU` on sequences — and **`REVOKE … FROM PUBLIC` does not remove it**, because these are explicit per-role grants. Observed: a probe table granted only `SELECT` to `authenticated` still had `anon=arwdDxtm`, its anon `INSERT` stopped by **RLS alone** (`42501`); a function revoked from `PUBLIC` was still executed by `anon`.
  **Fix applied:** forward migration `20260912150000_foundation_revoke_set_updated_at_execute.sql` revokes `EXECUTE` on `public.set_updated_at()` from `PUBLIC` and from each named role (role-existence guarded, so it is valid on any environment). A **forward** migration, not an edit — the original was already applied remotely and remote history is not rewritten. Verified on hosted: ACL is now `postgres=X/postgres`; an `authenticated` direct call is refused `42501`; **trigger behaviour preserved** (`updated_at` advanced, forged value ignored, `created_at` untouched), because `EXECUTE` on a trigger function is checked at `CREATE TRIGGER`, not at fire time.
  **The standing rule this leaves behind:** every migration from Phase 1 onward must `REVOKE` from `anon`/`authenticated`/`service_role` **by name** and assert the resulting ACL in a test — otherwise §5.2's grant-level control is aspirational and RLS silently becomes the only barrier.
- **B6 — ✅ RESOLVED 2026-09-12.** `pnpm test:db` now executes against the hosted project via a `DATABASE_URL` in the git-ignored `.env.local`: **26 passed, 0 failed, 0 skipped**, harness reporting `kind: "supabase"`. The harness resolves the Supabase API URL and anon key from the **documented** names (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), loading `.env.local` only for keys absent from the environment, and **fails loudly rather than defaulting to localhost** when `DATABASE_URL` is remote but no API URL is configured. CI now exports those same documented names, so there is no second secret convention.

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

**Finish Phase 0** — and only that. Phase 1 / Prompt 13 is **not** yet the next allowed task.

Done on 2026-09-12: the hosted project is linked, all three migrations are applied through the CLI, Storage privacy is verified, **B2 is closed**, and **B5 and B6 are closed**. Every runnable Phase 0 gate has been executed and observed passing, including the committed DB suite against real Supabase.

What remains:

1. **Commit Phase 0** — `phases.md` Phase 0 Definition of Done includes the git checkpoint ("One commit: `chore: phase 0 foundation` … made only after gates pass"). Gates have now passed; the commit has deliberately not been made because the working sessions were instructed not to commit.
2. **Let CI run once** — the natural consequence of (1). Not itself a documented gate (see the note under "Current Phase"), but the first real execution of the configured workflow.

Only once (1) is done may Phase 0 be marked COMPLETE and the next task advanced to **Phase 1 / Prompt 13 — Authentication & Profile**. Phase 1's first migration must apply the B5 standing rule: `REVOKE` from `anon`/`authenticated`/`service_role` by name, and assert the ACL.

**Foundation configuration fact, corrected by measurement.** `supabase/config.toml` sets `auto_expose_new_tables = false`, which applies to the **local CLI stack only**. The hosted project does **not** behave that way: `ALTER DEFAULT PRIVILEGES` grants `anon`/`authenticated`/`service_role` full DML on new `public` tables and `EXECUTE` on new functions (B5). The earlier note that "each cloud project must be configured to match" was right to flag this — it is now confirmed that the cloud project does **not** match, and the required action is an explicit `REVOKE` in every migration (not a `PUBLIC` revoke, which does nothing here).

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

STOP — Prompts 01–11 complete (documentation planning and audit). **Phase 0 / Prompt 12 is IN PROGRESS, pending only its git checkpoint.** As of 2026-09-12: the foundation is built, all three migrations are applied to the linked hosted project, Storage privacy is verified, **B2, B5 and B6 are all CLOSED**, and every runnable gate was executed and observed passing — including `corepack pnpm test:db` at **26 passed / 0 failed / 0 skipped** against real Supabase (`kind: "supabase"`). Outstanding: the commit (`chore: phase 0 foundation`) and the first CI run that follows it. **Next Task: commit Phase 0.** Phase 1 / Prompt 13 is not yet authorised.
