# BatchVault Project Memory

*This is a concise handoff for future AI coding sessions — not a replacement for the source documents. If anything here conflicts with `project-context.md`, `PRD.md`, `architecture.md`, `database.md`, `security.md`, `rules.md`, `design.md`, `phases.md`, or `testing.md`, **those documents win**, and this file is wrong and must be corrected to match them.*

## Product Purpose

BatchVault is a private, collaborative digital memory / time-capsule home for a college batch (institution + course + department + graduation year + section). Members collectively build a shared, chronological archive of photos, videos, captions, stories, and events, designed for long-term revisiting — not daily social consumption.

Core MVP loop: signup → onboarding/profile → create batch → invite classmates → join/request approval → upload memories/media → gallery/timeline/detail → comments/reactions → moderation/privacy → production readiness.

The product **is**: privacy-first, invite-only by default, batch-scoped, mobile-first, photography/memory-first, modern/emotional/youthful/premium, nostalgic without looking old, built for long-term preservation and revisiting.

The product is **not**: a generic social network, an Instagram/TikTok/WhatsApp clone, a public directory, a cloud-drive replacement, a dating product, or an engagement-maximization feed.

## Current Phase

**Phase 3B — Membership Decisions & Roles: COMPLETE** (2026-10-18). See "Phase 3B — Membership Decisions & Roles (complete)" below for full detail. **Nothing has been committed** — this session was told not to commit.

**Phase 3A — Invitations & Join: COMPLETE** (2026-10-18). See "Phase 3A — Invitations & Join (complete)" below for full detail.

**Phase 2 — Batch Spaces: COMPLETE** (2026-09-26). See "Phase 2 — Batch Spaces (complete)" below for full detail.

**Correction (2026-09-26 session):** the note below saying Phase 0 was "pending only its git checkpoint" was itself committed in `c8ae566 chore: complete phase 0 foundation` — i.e. the file said "not yet committed" inside the commit that committed it. **Phase 0 is in fact COMPLETE**: the commit exists, `git log` confirms it, and every gate recorded below as passing was passing at that commit. This paragraph corrects that stale self-reference; nothing about Phase 0's substance changes.

**Phase 1 — Authentication & Profile: COMPLETE** (2026-09-26, resumed and finished in the same session that found it blocked — the hosted dev project came back healthy). See "Phase 1 — Authentication & Profile (complete)" below for full detail.

**Phase 0 — Foundation: COMPLETE** (commit `c8ae566`). Documentation Prompts 01–11 are complete, including the Prompt 11 audit. The Phase 0 repository, toolchain, environment boundary, Supabase client boundaries, migration framework, private Storage buckets, test harnesses and CI are in place.

**B2 is now CLOSED.** On 2026-09-12 the execution model was verified empirically against a **real hosted, non-production Supabase project** (`BatchVault-Dev`, ref `idmpwblennrdpasfnbyw`, PostgreSQL 17.6, `ap-southeast-1`) across two transports — direct SQL and the production PostgREST surface with a real Supabase Auth JWT. Full results, and the distinction between the earlier reconstructed findings and the real ones, are in `security.md` §32 "B2 verification status". The Supabase-dependent checks that had never run — migrations applied through the CLI, and Storage bucket privacy — were also executed against that project and passed.

**The committed DB gate now also passes against the hosted project.** `pnpm test:db` → **26 passed, 0 failed, 0 skipped, 3 files**, harness reporting `kind: "supabase"`, `ownerRole: "postgres"`, PostgreSQL 17.6. B6 and B5 are both closed (below).

**What remains before Phase 0 can be declared COMPLETE:** only the **git checkpoint** — `phases.md` Phase 0 Definition of Done includes "One commit: `chore: phase 0 foundation` … made only after gates pass", and nothing has been committed. A first green CI run follows naturally from that commit.

A prior session over-stated two items as hard Phase 0 blockers; on review of `phases.md`, `testing.md` §1/§6 and `rules.md` §7 they are **not**:

- *"CI must have executed"* — `testing.md` §1 defines **Executed** as "actually ran in a real session (**local or CI**)", and `testing.md` §6 (explicitly aligned with `phases.md`'s gate table and `rules.md` §7) names **no CI-execution gate**. `phases.md`'s own Git checkpoint puts the commit *after* gates pass, so requiring a green CI run first would be circular.
- *"three environments must physically exist"* — `phases.md` says separate projects for **local / preview / production** and architecture §15 frames this as **per-environment isolation** with secrets in *Vercel project settings*. Phase 0 has no deployment scope; "production deployment readiness" is **Phase 9**. The Phase 0 criterion is the resolution/isolation mechanism, which the split typed env module already provides.

No product table exists on the hosted project (verified: 0 tables in `public`). No auth flow, no feature module, and no product screen exists.

## Phase 1 — Authentication & Profile (complete)

**Status: COMPLETE.** Implemented per Prompt 13 (`13_PHASE_1_AUTH_PROFILE.md`) and `phases.md` Phase 1. Started 2026-09-26, blocked mid-session when the hosted dev project (`BatchVault-Dev`, ref `idmpwblennrdpasfnbyw`) briefly could not be reached (DNS/pooler failure); the user confirmed the project healthy and this session resumed and finished from exactly that point — no rework, no scope drift.

### What was implemented

**Database — three migrations applied to the hosted dev project via direct SQL (not `supabase db push`, which needs Docker; see "Known issues" below) and verified by 50 passing adversarial tests:**

- `20260926120000_phase1_profiles.sql` — `profiles` (RLS enabled+forced in the same migration; `id` defaulted from `auth.uid()` with **no INSERT grant on that column at all**; `display_name`/`bio` the only ordinarily-writable columns, security.md §5.4.1; every named client role explicitly `REVOKE`d before granting back, per the B5 standing rule).
- `20260926120100_phase1_profile_controlled_writes.sql` — two controlled write paths per security.md §5.4.3: `complete_onboarding()` (idempotent; sets `onboarding_completed_at = coalesce(..., now())` for the caller's own, non-deleted row) and `set_own_avatar_path(object_path text)` (checks the path's first segment equals `auth.uid()`, and that a real object exists at that path in the `avatars` bucket, before recording it). Both `SECURITY DEFINER`, schema-qualified, pinned empty `search_path`, derive the caller from `auth.uid()` with an explicit NULL branch, `EXECUTE` granted to `authenticated` only.
- `20260926120200_phase1_avatar_storage_policies.sql` — self-only Storage policies on `storage.objects` for the `avatars` bucket (select/insert/update/delete, each scoped to `(storage.foldername(name))[1] = auth.uid()::text`). The `batch-media` bucket remains untouched and policy-less (Phase 4A scope).
- `types/database.ts` generated from the live schema via `supabase gen types typescript --linked` (rules.md §1.1 — now enforced: hand-written row types are no longer permitted). `lib/supabase/{client,server,service-role}.ts` now parametrize their Supabase clients with `Database`.

**Backend:**

- `features/authentication/` — `schema.ts`, `types.ts`, `redirects.ts` (the callback redirect allowlist, security.md §13 — only `/home`/`/onboarding` are ever trusted), `actions.ts` (`signUpAction`, `signInAction`, `signOutAction`, `requestPasswordResetAction`, `updatePasswordAction`). Every action: authenticate → validate → authorize → execute → revalidate/redirect; every expected failure returns the same generic message (security.md §3).
- `features/profiles/` — `schema.ts`, `types.ts`, `permissions.ts` (own-row-only; the shared-batch clause is deliberately **not** approximated — it needs `batch_members`, Phase 2), `queries.ts` (`getOwnProfile`, `getOwnAvatarUrl`), `actions.ts` (`saveOwnProfileAction` create-or-update, deliberately **separate** from `markOnboardingCompleteAction` because the avatar controlled-write path needs the profile row to already exist; `updateProfileAction`; `requestAvatarUploadAction`/`confirmAvatarUploadAction` for the server-composed-path avatar flow).
- `lib/auth/session.ts` — `getVerifiedUser()`, `hasCompletedOnboarding()`.
- `lib/env` — added `NEXT_PUBLIC_SITE_URL` (client-safe; builds the absolute `emailRedirectTo`/`redirectTo` Supabase Auth requires). **`lib/env/schema.ts` was split into `client-schema.ts` and `server-schema.ts`** — see "Durable decision: the env-schema split" below; this is a real fix, not a refactor for its own sake.
- `middleware.ts` — session refresh only, exactly per rules.md §1.2 ("does nothing else"). Route protection lives in each group's `layout.tsx` instead: `(auth)/layout.tsx` (bounces an already-signed-in user away), `(onboarding)/layout.tsx` (requires a session, bounces the already-onboarded away), `(app)/layout.tsx` (requires a session **and** completed onboarding).

**Frontend — pages and components**, all React Hook Form + Zod, accessible (`aria-describedby`/`aria-invalid` via the new `FormField` primitive), mobile-first:

- `/sign-up`, `/sign-in`, `/forgot-password` (all under `(auth)`), `/onboarding` (under `(onboarding)`), `/home`, `/settings` (both under `(app)`).
- `/reset-password` is **deliberately outside `(auth)`**: a recovery-session user genuinely has an active session, so `(auth)`'s "already signed in, go away" guard would break that exact flow. It owns its own check (no session at all → "link expired").
- `app/(auth)/callback/route.ts` — PKCE code exchange, no body to parse, redirect target allowlisted before anything else runs.
- `components/ui/{input,label,textarea,form-field}.tsx` — minimal vendored primitives.
- `features/profiles/components/avatar-uploader.tsx` — server-composed path (`{auth.uid()}/{uuid}`), direct-to-Storage upload via `uploadToSignedUrl`, then the controlled write path records it. Client-side type/size checks are explicitly documented as UX-only (architecture §8, ADR-08a analog).

### Durable decision: the env-schema split (found and fixed by the artifact-scan gate, not assumed safe)

Phase 0's `lib/env/schema.ts` defined **both** `clientEnvSchema` and `serverEnvSchema` in one module. Once a real Client Component (`AvatarUploader`) started importing the browser Supabase client — which imports `lib/env/client.ts` — the literal string `SUPABASE_SERVICE_ROLE_KEY` (the variable *name*, never a real value) became reachable through that same module and landed in a built client chunk. `pnpm test:artifacts` caught this for real, not hypothetically. Fixed by physically splitting the module: `lib/env/client-schema.ts` (client-safe; the only thing `client.ts` may ever import) and `lib/env/server-schema.ts` (server-only; imported only by `server.ts`). The old `lib/env/schema.ts` is deleted. **Standing rule from here on:** `client.ts` must only ever import from `client-schema.ts`, never through anything that also reaches the server-only schema — this is exactly the shape of mistake that leaks a secret's name (and, in a less careful version, its value).

A second, smaller fix from the same gate: the artifact scanner's own heuristic for `"sb_secret_"` was too broad — it matched the *legitimate*, client-shippable `isSecretShapedKey()` prefix-detection string (10 characters, no suffix), which must run in the browser to validate that `NEXT_PUBLIC_SUPABASE_ANON_KEY` itself isn't secret-shaped. Narrowed to require a realistic secret-length suffix (16+ trailing characters) and to decode JWT-shaped literals and check the actual `role` claim, rather than matching any JWT structure (the anon key is also legitimately a JWT).

### Tests written and gates actually executed (all against the real hosted `BatchVault-Dev` project)

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | **PASS** |
| Typecheck | `pnpm typecheck` | **PASS** |
| Unit tests | `pnpm test:unit` | **PASS** — 23 tests |
| Adversarial DB suite | `pnpm test:db` | **PASS** — 50 tests, 5 files (`profiles.test.ts` new: 18 tests; `avatar-storage.test.ts` new: 6 HTTP-level tests; plus the Phase 0 `b2-execution-model`/`foundation-migrations`/`storage-buckets` suites, two of which needed real fixes — see below) |
| Production build | `pnpm build` | **PASS** |
| Client artifact scan | `pnpm test:artifacts` | **PASS** — 3 tests (after the env-schema-split fix above) |
| Dependency audit | `pnpm audit --prod --audit-level high` | **PASS** — no known vulnerabilities |
| Playwright E2E | `pnpm test:e2e` | **PASS** — 30 passed, 2 explicitly skipped (both named, neither silent — see below) |

**New test files:** `tests/db/profiles.test.ts` (unauthenticated access; identity-on-insert forgery; column-level enforcement on UPDATE for `id`/`deleted_at`/`onboarding_completed_at`/`avatar_path`; the onboarding-completion **matched pair** — legitimate path succeeds and is idempotent, direct DML stays refused including a caller-chosen timestamp and another user's row; the avatar-path controlled write path against a **real seeded Storage object** — success for the caller's own object, refusal for another profile's object, an arbitrary path, and a well-formed own-prefix path with no real object behind it; `EXECUTE` grants), `tests/db/avatar-storage.test.ts` (real HTTP calls against the Storage REST API with real bearer tokens — self-read succeeds, another authenticated user's read/upload refused, unauthenticated refused), `tests/db/support/auth-fixtures.ts` (disposable real Auth users via the Admin API, since `profiles.id`'s real FK to `auth.users` means a synthetic UUID — the B2-probe pattern — cannot be used here). `tests/e2e/auth-onboarding-flow.spec.ts`, `auth-signup.spec.ts`, `auth-accessibility.spec.ts`, `tests/e2e/support/user-fixtures.ts`.

**Real defects the gates caught and this session fixed, not worked around:**

1. **Two stale Phase-0-era test assertions.** `foundation-migrations.test.ts` asserted `profiles` must not exist; `storage-buckets.test.ts` asserted zero Storage policies must exist. Both were correct for Phase 0 and are now correctly updated for what Phase 1 legitimately creates (not weakened — `storage-buckets.test.ts` now asserts the *exact* four avatar policy names and that none of them touch `batch-media`).
2. **A `Date`-object equality bug** in the onboarding-idempotency test (`pg` returns `timestamptz` as `Date` instances; `toBe` is reference equality, not value equality) — fixed with `toEqual` and a same-transaction sequential-call structure instead of relying on `UNION ALL` evaluation order.
3. **The env-schema client/server leak**, above — a real security-relevant fix.
4. **A real WCAG AA contrast failure**: `--bv-primary` (`oklch(0.62 0.145 48)`, `#ca662b`) against `--bv-primary-foreground` measured 3.73:1 via axe on an actual text-labeled primary button (`Create account`) — Phase 0 never exercised this combination (its only primary-styled control was an icon button, held to the looser 3:1 non-text threshold). Darkened to `oklch(0.5 0.155 48)` / hover `oklch(0.45 0.16 48)`.
5. **A Playwright strict-mode violation**, not a product bug: Next.js's own `#__next-route-announcer__` accessibility live region mirrors heading text for screen readers, so a bare `getByText(name)` ambiguously matched both it and the real heading. Scoped the assertion to the heading role instead.
6. **Supabase Cloud's public `signUp` domain validation** rejects `@example.com` (an `email_address_invalid` the Admin API used elsewhere in the suite does not enforce) — every test fixture now uses `@bv-e2e-test.dev` instead.

**The two explicitly-skipped E2E tests (both named, neither silent, per testing.md's "skipped is always named, never implied"):** `auth-signup.spec.ts`'s "check-your-email" test is scoped to run on one browser project only (it is the one test that sends a real Supabase confirmation email, and running it on every project would multiply real sends against the hosted project's outgoing-email quota for no additional coverage), and separately detects the specific `over_email_send_rate_limit` condition and skips with that exact reason if the hosted project's quota is already exhausted when the suite runs — this happened during this session (the quota was consumed by this session's own repeated runs) and is an external Supabase Cloud limit, not a code defect. **This is the one Phase 1 behavior not fully exercised end-to-end by this session's own run**; the signup→"check your email" UI branch is proven by code review and by the identical logic path `signUpAction` shares with the confirmed-working sign-in/onboarding flow, but not by a green assertion in this run specifically.

**Known, accepted, honestly documented (not gaps to silently fix later):**

- Migrations were applied via a direct `pg` connection reading `.env.local`, not `supabase db push --linked` — the CLI's own type-generation (`--linked`) worked fine (no Docker needed for that path), but `db push`/`db reset` require the local Docker-backed shadow database, still unavailable on this machine. The CLI's migration ledger (`supabase_migrations.schema_migrations`) was updated manually to stay consistent for future `supabase migration list --linked` calls.
- `middleware.ts` triggers a Next.js 16 deprecation notice ("use proxy instead") — non-blocking, left as `middleware.ts` because every doc (`architecture.md` §4, `rules.md` §1.2) refers to it by that name; a rename is a future, separately-scoped cleanup.
- Avatar visibility remains strictly self-only in this phase, as scoped — no co-member read path exists because `batch_members` does not exist yet.

### memory.md update

Phase 1 complete; `profiles` shipped with its writable-column set (`display_name`, `bio`); co-member avatar visibility deferred to Phase 2, per phases.md's own instruction for this update.

## Phase 3B — Membership Decisions & Roles (complete)

**Status: COMPLETE.** Implemented per Prompt 15 (`15_PHASE_3_INVITES_JOIN.md`, "Phase 3B" section) and `phases.md` Phase 3B. No batch deletion, account deletion, content moderation, or platform tooling was built (all explicitly out of scope). Scoped update only — see Phase 3A above for full narrative conventions this phase reuses unchanged (direct-`pg` migration apply, `NODE_OPTIONS=--use-system-ca`, the pnpm shim for Playwright's webServer).

**Database — one migration, no new tables** (`phases.md`: "status/role transitions on `batch_members` plus audit rows"), applied via direct `pg` connection and hand-extended into `types/database.ts`:

- `20261018150000_phase3b_membership_rpcs.sql` — five `SECURITY DEFINER` RPCs, all keyed by `(p_batch_id, p_target_profile_id)` rather than the membership row id (matches what the roster already exposes): `approve_member`/`reject_member` (mod+ only; legal transition is `pending` → `active`/`rejected` only); `remove_member` and `change_member_role` both built on **one ceiling comparison** — `caller_role > target.role` (and, for role changes, also `caller_role > p_new_role`) — which reproduces every row of security.md §4's capability matrix exactly, including a moderator's effective zero role-change capability, with no per-tier special-casing; `transfer_ownership` (owner-only, demotes the outgoing owner **before** promoting the new one, since the at-most-one-active-owner partial unique index is a plain index, not a deferrable constraint, and would reject the reverse order mid-transaction). All five `returns public.batch_members` directly (not `RETURNS TABLE`) — `batch_members` has no column needing exclusion, so there was no reason to repeat Phase 3A's `RETURNS TABLE`/OUT-parameter name-collision hazard here.
- Same migration also adds `profiles_select_pending_review`, a narrow additive RLS policy: **a real defect this phase's own feature would otherwise ship broken.** Phase 2's `profiles_select_shared_batch` only admits a profile whose membership `status = 'active'`, so a mod+ reviewing the pending-approval queue could not see a pending requester's name at all. Scoped exactly to that need (mod+ of the same batch, target `status = 'pending'`), proven safe against the recursion trap for the identical reason Phase 2's own policy documents.

**A second real defect found and fixed, not caused by new code but newly exercised by it:** `features/profiles/queries.ts`'s `getOwnProfile()` and `features/profiles/actions.ts`'s `saveOwnProfileAction()` both queried `profiles` with **no `WHERE id = ...` filter**, relying entirely on RLS to scope to "my own row." That was always fragile — Phase 2's own shared-batch policy already meant an unfiltered query could admit a co-member's row too — but it only actually returns >1 row once two people are truly co-members of the same batch, which no earlier phase's E2E test happened to exercise at the moment `getOwnProfile()` ran. This phase's own membership-flow E2E test does, and it surfaced real `PGRST116` ("multiple rows") server errors. Fixed by adding the explicit `.eq("id", userData.user.id)` filter both places — never relying on RLS alone to do a WHERE clause's job.

**Backend:** `features/memberships/schema.ts` (five Zod schemas; `change_member_role`'s `newRole` input excludes `'owner'` at the schema layer, not just the RPC); `actions.ts` (`approveMemberAction`, `rejectMemberAction`, `removeMemberAction`, `changeMemberRoleAction`, `transferOwnershipAction` — the last re-verifies the typed confirmation name server-side, never trusting the client-side match alone); `permissions.ts` extended with `canDecideJoinRequests`, `canRemoveMember`, `canAssignRole`, `canTransferOwnership`, `assignableRoles` (Layer 2 only, mirroring the RPCs' own ceiling rule).

**Frontend:** `/batches/[batchId]/members` now shows a "Waiting for approval" queue (mod+ sees Approve/Decline; a plain member sees nothing — `canDecideJoinRequests` gate) above the active roster; `MemberRowActions` (client component) adds Remove (plain `window.confirm`, the "explicit confirmation step" tier), a role-change `<select>` filtered to roles the caller could actually assign, and — owner only — an expandable "Transfer ownership" control requiring the admin to **type the exact target display name** before the highest-tier confirmation unlocks (design.md §13-16's typed-confirmation requirement, built without a modal primitive this repo hasn't vendored yet). Every action calls `router.refresh()` on success — `revalidatePath` alone does not re-render an already-mounted client page, which the first E2E run caught directly (role/removal/approval changes were invisible without it until that fix).

**Tests run (scoped to this phase, per this session's instructions — not a historical re-audit):**

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | **PASS** |
| Typecheck | `pnpm typecheck` | **PASS** |
| Production build | `pnpm build` | **PASS** |
| Unit (new) | `vitest run --project unit tests/unit/membership-permissions.test.ts` | **PASS** — 15 tests |
| Adversarial DB (new) | `vitest run --project db tests/db/memberships.test.ts` | **PASS** — 32 tests (the ceiling rule proven at every ceiling boundary: mod removes member ✅, admin removes moderator ✅, mod removes admin ❌, admin removes peer admin ❌; admin promotes member→moderator ✅, admin demotes moderator→member ✅, owner promotes member→admin ✅, admin attempting admin ❌, admin touching a peer admin ❌, moderator role-changing anyone ❌, `'owner'` never assignable via this RPC, no self-role-change; atomic ownership transfer with before/after audit; the exactly-one-owner partial unique index rejected directly, independent of any RPC; the new pending-review profile policy's own mod+/member/non-member cases) |
| E2E (new flow only) | `playwright test tests/e2e/membership-management-flow.spec.ts --project=chromium-desktop` | **PASS** — approve → promote to moderator → remove, full round trip |
| E2E (re-run, Phase 3A's flow — confirms the `getOwnProfile()` fix didn't regress it) | `playwright test tests/e2e/invite-join-flow.spec.ts --project=chromium-desktop` | **PASS** — both tests, no `PGRST116` noise |

Not re-run this session (per instructions — scoped to this phase, not a historical audit): `pnpm audit`, the full historical adversarial suite (`invites.test.ts`, `batches.test.ts`, `profiles.test.ts`, etc.), and the full E2E suite. None of this phase's changes touched `batches`, `batch_invites`, or their existing policies.

**Known, accepted:** moderator/member removal and role-change confirmations use `window.confirm` / a plain typed-text field rather than a vendored modal dialog (none exists in this repo yet) — functionally meets rules.md §5's confirmation-scaling requirement, but is visually a simplification of design.md §16's drawer/centered-modal language; a future UI-polish pass can swap the mechanism without touching the RPCs or Server Actions. Self-leave ("left" status) is not built — not in this phase's scope.

### memory.md update

Phase 3B complete; the audited action set (`member_approved`, `member_rejected`, `member_removed`, `role_changed`, `ownership_transferred`) is now live; the one-ceiling-comparison design and the two real defects (pending-review profile visibility, unfiltered `getOwnProfile`/`saveOwnProfileAction`) are recorded as durable fixes, not workarounds.

## Phase 3A — Invitations & Join (complete)

**Status: COMPLETE.** Implemented per Prompt 15 (`15_PHASE_3_INVITES_JOIN.md`, "Phase 3A" section) and `phases.md` Phase 3A. Phase 2 was already complete; Q1/PRD #1–2 were already resolved (Phase 2). **Only Phase 3A was built — no Phase 3B (membership decisions, roles, approval UI) work was done**, per the phase's own STOP boundary.

### What was implemented

**Database — three migrations applied to the hosted dev project via a direct `pg` connection** (the `supabase` CLI's `--linked` network calls to `api.supabase.com` failed with a transport error in this session's sandbox — see "Known issues" below — so migrations were applied the same way Phase 1's session did, and `types/database.ts` was hand-extended from the live schema rather than CLI-generated, for the same reason):

- `20261018140000_phase3a_batch_invites.sql` — `batch_invites` (database.md §3.4; RLS enabled+forced in the same migration; `UNIQUE(token_hash)`, `UNIQUE(id, batch_id)`; zero INSERT/UPDATE/DELETE grant to any client role — RPC-only, matching `batches`/`batch_members`; **column-level `SELECT` grant deliberately excludes `token_hash`**, security.md §9; admin+-of-that-batch SELECT policy via `my_batch_role(batch_id) >= 'admin'`). Also adds `batch_members.invite_id` (database.md §3.3, deliberately deferred by Phase 2) with its composite FK to `batch_invites(id, batch_id)` and `ON DELETE SET NULL (invite_id)`.
- `20261018140100_phase3a_invite_rate_limiting.sql` — `invite_redemption_attempts`: a small, append-only bookkeeping table for security.md §17's "Invite redemption — IP and account" rate-limit requirement. **This is not a `database.md` MVP table** — no source document fixes a rate-limiting mechanism, the same latitude rules.md §1.3 gives RPC names/signatures — so this is a narrow, documented implementation choice to satisfy an already-written requirement, not a new product/schema decision. RLS enabled+forced; zero client-role grants at all (same posture as `audit_logs`); written/read only from inside the two functions that need it, which run as the `BYPASSRLS`-holding owner.
- `20261018140200_phase3a_invite_rpcs.sql` — five functions, all `SECURITY DEFINER`, schema-qualified, pinned empty `search_path`, no dynamic SQL: `check_invite_rate_limit(ip, profile_id)` (private helper, no client grant at all — prunes rows older than 1 day, then refuses with the SAME generic exception as an invalid token once 20 attempts exist in a trailing 15-minute window keyed by IP or account, security.md §17's explicit "must not distinguish wrong-token from too-many-attempts"); `validate_invite(token_hash, ip)` (the "deliberately minimal unauthenticated read for invite landing" security.md §5.4 already names — batch name only, after validation; **granted to `anon` AND `authenticated`**, the one deliberate exception to this phase's authenticated-only default, since a recipient has not necessarily signed in yet, PRD Journey C; mutates nothing); `redeem_invite(token_hash, ip)` (authenticated only; locks the invite row `FOR UPDATE` before checking/incrementing `use_count`, database.md §3.4's documented concurrency requirement; `role` is always hard-coded `'member'`; idempotent re-redemption of an already active/pending row does not double-charge `use_count`; a `removed`/`left` member redeeming a fresh link is refused, not silently reactivated, security.md §9.1); `create_invite`/`revoke_invite` (admin+ only, resolved via `my_batch_role`, each writing one `audit_logs` row — `invite_created`/`invite_revoked`, both already in Phase 2's `audit_action` enum; `revoke_invite` is idempotent, no duplicate audit row on a second revoke). **A real bug the adversarial suite caught before any test depended on it**: `revoke_invite`'s and `redeem_invite`'s bare `where id = ...`/`where id = p_invite_id` clauses were genuinely ambiguous in Postgres — `RETURNS TABLE(id uuid, ...)` declares `id` as an implicit PL/pgSQL OUT-parameter variable in scope for the whole function body, colliding with the real column name. Fixed by qualifying every reference with a table alias (`bi.id`). `create_invite`/`revoke_invite` deliberately `RETURNS TABLE` of named columns rather than `public.batch_invites` — the only way to keep `token_hash` out of the RPC's own result, since a column-level `GRANT` does not restrict what a function returns.

**Durable decision: raw-token hashing happens in Node, not SQL.** `features/invitations/token.ts` generates the raw token (`crypto.randomBytes(32)`, base64url) and its SHA-256 hash entirely in the Server Action layer; only the hash ever reaches a database call. This avoids introducing a `pgcrypto` dependency this schema has never otherwise needed, and means the raw token's only moment of existence is one request's Node process memory — never logged, never returned from a database call, never persisted.

**Backend:**

- `features/invitations/` — `schema.ts`, `types.ts`, `permissions.ts` (`canManageInvites`, admin+), `token.ts` (raw-token generation/hashing), `request-ip.ts` (best-effort `x-forwarded-for` extraction for the rate limit's IP dimension — an explicitly documented, accepted limitation off of a trusted edge), `queries.ts` (`listBatchInvites`, `isInviteUsable` — a display computation only, never an authorization decision), `actions.ts` (`createInviteAction`, `revokeInviteAction`, `validateInviteAction`, `redeemInviteAction`).
- `createInviteAction` is the only place the raw token exists; it builds the shareable `{site}/invite#{token}` URL once and returns it in the action's own result — never read back from anywhere, matching security.md §9.1's "token travels in the URL fragment."
- `redeemInviteAction` returns `requiresAuth: true` for an unauthenticated caller **without calling the RPC at all** — so a visitor who has not signed in yet never spends a rate-limit hit on a call that cannot succeed.

**Frontend:**

- `/batches/[batchId]/invite` — admin+-only invite creation/list/revoke (`InviteManager`, `InviteCreateForm`); the just-created link is shown once, in a copyable row, and is never retrievable again (matching the fact that only the hash is ever stored).
- `/invite` — the public landing/redemption page, deliberately outside every auth-gated route group. `InviteLandingView` is a **Client Component** because the raw token lives in the URL **fragment**, which is never sent to the server at all (security.md §9.1) — reading it, and then replacing the visible URL via `history.replaceState`, can only happen client-side. Calls `validateInviteAction` (anon-capable) to show the batch name, then `redeemInviteAction` only on an explicit "Join" click.
- **The sign-in detour never puts the token back in a URL.** An unauthenticated visitor who clicks "Join" has the token stashed in `sessionStorage` (never a query string) and is routed to `/sign-in`; a new `PendingInviteRedirect` component rendered on `/home` (where every auth flow in this product already lands) detects the pending token after sign-in/onboarding and routes back to `/invite` with no hash at all — `InviteLandingView` reads the fallback from `sessionStorage` directly. No change was made to `features/authentication`'s redirect allowlist.
- Batch home (`/batches/[batchId]`) gained an "Invite classmates" link, admin+ only (`canManageInvites`).

**Tests written and gates actually executed (all against the real hosted `BatchVault-Dev` project):**

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | **PASS** |
| Typecheck | `pnpm typecheck` | **PASS** |
| Unit tests | `pnpm test:unit` | **PASS** — 23 tests (unchanged) |
| Adversarial DB suite | `pnpm test:db` | **PASS — 121 passed, 0 failed, 7 files** (`invites.test.ts` new: 33 tests; `foundation-migrations.test.ts` updated — see below; the other five Phase 0–2 files unchanged and still passing) |
| Production build | `pnpm build` | **PASS** |
| Client artifact scan | `pnpm test:artifacts` | **PASS** — 3 tests |
| Dependency audit | `pnpm audit --prod --audit-level high` | **FAIL — pre-existing, not caused by this phase.** `next@16.3.4` carries five known advisories (one critical, several high/moderate), patched at `>=16.3.8`. `package.json`/`pnpm-lock.yaml` have zero diff from before this session (`git diff --stat` confirmed) — this dependency was already at this version when Phase 3A began. Upgrading Next.js is an unrelated change outside this phase's scope ("implement ONLY Phase 3"); recorded here as a known, pre-existing gate failure, not silently fixed or silently ignored. |
| Playwright E2E | `pnpm test:e2e` | **PASS** — 38 passed, 2 explicitly-named skips (the same pre-existing, quota-guarded "check-your-email" skip from Phase 1, unrelated to this phase). New: `invite-join-flow.spec.ts` (owner creates an invite → copies the link → signs out → an unauthenticated recipient follows the link, sees the batch name, is routed through sign-in/onboarding, and the pending redemption resumes automatically and lands them in the batch; plus an invalid-token generic-failure case), on both projects. **One cold-start flake** on the very first two tests scheduled (an a11y scan hitting its 30s navigation timeout immediately after `playwright install` finished downloading the browser) — clean on an isolated re-run, the same documented pattern Phase 0's session recorded |

**New test files:** `tests/db/invites.test.ts` (table privilege + column-level `token_hash` exclusion; the private rate-limit helper refusing every client role directly; `create_invite`/`revoke_invite` admin+-only checks including cross-batch and anon refusal, idempotent revoke, exactly-one audit row each; `validate_invite`'s anon-and-authenticated callability, one indistinguishable generic failure for never-issued/revoked/expired/exhausted tokens, non-mutation of `use_count`, and a seeded-rate-limit-hit test; `redeem_invite`'s anon refusal, both join-policy paths (active vs. pending), idempotent re-redemption without double-charging `use_count`, the removed-member-does-not-rejoin case, revoked/exhausted refusal, and a genuine two-connection concurrency test proving a `max_uses = 1` invite is redeemed exactly once). `tests/e2e/invite-join-flow.spec.ts`.

**Known, accepted, honestly documented (not gaps to silently fix later):**

- **The `supabase` CLI's `--linked` commands (`db push`, `gen types --linked`, `projects list`) all failed with a transport error reaching `api.supabase.com` in this session's sandbox**, despite a successful raw TCP connect to the same host on port 443 — most likely an auth-token or proxy/TLS-interception issue specific to this sandboxed environment, not investigated further since a working alternative existed. Migrations were applied via a direct `pg` connection reading `.env.local` (the same fallback Phase 1's session used for a different reason). `gen types --db-url` was also tried and failed differently (`LegacyDockerRunError` — that code path needs Docker, matching the already-documented Phase 1 finding that `db push`/`db reset` need Docker but `--linked` type generation historically didn't). **`types/database.ts` was hand-extended to match the live schema exactly** (verified against the real migration SQL, not guessed) rather than CLI-generated — a deliberate, narrow, documented exception to rules.md §1.1's "types are generated, never hand-maintained," forced by this environment's tooling constraints, not a convenience.
- **`pnpm audit` fails on a pre-existing `next` version**, unrelated to this phase — see the gate table above.
- **Node's default TLS trust store did not include whatever CA this sandbox's network path uses**, causing `fetch failed`/`UNABLE_TO_VERIFY_LEAF_SIGNATURE` errors against Supabase's Auth Admin API and Storage REST endpoints until every test run in this session set `NODE_OPTIONS=--use-system-ca`. This is an environment configuration fact worth carrying into later sessions on this same machine, not a product or test defect.
- **Playwright's default `fullyParallel` scheduling (the project's own configured default) exceeded what this sandbox could reliably run**, producing navigation timeouts across both new and pre-existing, unrelated specs (`foundation-smoke`, `auth-accessibility`, `batch-creation-flow`) when run at full concurrency. Re-running with `--workers=2` (and once, `--workers=1`, to isolate a specific failure) made every one of those same tests pass — this is sandbox resource contention, not a regression in any phase's code, and the full suite's real signal (38 passed, 2 named skips) was obtained at reduced concurrency, not by skipping anything silently.
- `pnpm` is not on this sandbox's `PATH` (same fact Phase 0's session recorded); a disposable `corepack pnpm`-wrapping shim script was used only so Playwright's own `webServer` config (which invokes bare `pnpm start`) could launch. Nothing under version control depends on this.
- The invite-redemption rate limit (20 attempts / 15-minute trailing window, combined IP-or-account) is a deliberately simple, Postgres-only mechanism — no Redis/Upstash, which is not on the locked stack. Its IP dimension is best-effort (`x-forwarded-for`, spoofable off a trusted edge) by nature; the account dimension is the half that cannot be forged.
- No UI exists yet for a batch admin to see **who** is pending approval or to approve/reject — that is explicitly Phase 3B scope (`listBatchMembers`'s existing roster view already shows pending rows to an active member, per Phase 2, but there is no action on them yet).

### memory.md update

Phase 3A complete; `batch_invites`, `invite_redemption_attempts`, and `batch_members.invite_id` shipped; the token-hashing design (raw token never reaches SQL) and the rate-limit mechanism (Postgres-only, IP-or-account) are recorded as durable decisions.

## Phase 2 — Batch Spaces (complete)

**Status: COMPLETE.** Implemented per Prompt 14 (`14_PHASE_2_BATCHES_MEMBERSHIP.md`) and `phases.md` Phase 2. B2 was already CLOSED (Phase 0) and was re-confirmed, not re-investigated: `pnpm test:db` exercises `b2-execution-model.test.ts` on every run and it passed as part of this session's 88/88.

**Decision recorded first, per phases.md's own prerequisite** — Q1 / PRD unresolved #1–2 (the `join_policy` default this phase encodes): resolved as **`invite_only_requires_approval`** default, **owner/admin-configurable** per batch. Updated in `docs/PRD.md` (unresolved #1–2, now resolved) and `docs/database.md` (Q1, now resolved) before any migration was written.

### What was implemented

**Database — three migrations applied to the hosted dev project via `supabase db push --linked` (Docker was not needed this time — unlike Phase 1's session, `db push` worked directly) and verified by 88 passing adversarial tests:**

- `20260926130000_phase2_batches_and_members.sql` — `batch_role`/`membership_status`/`batch_visibility`/`join_policy` enums; `batches` and `batch_members` tables (RLS enabled+forced in the same migration); the partial unique index enforcing at most one active owner; the `my_batch_role(p_batch_id uuid) returns batch_role` membership-predicate helper (`SECURITY DEFINER`, `STABLE`, pinned empty `search_path`, current-caller-only, `EXECUTE` granted to `authenticated` only); SELECT-only policies for both tables (RPC-only for every write — no INSERT/UPDATE/DELETE grant to any client role at all, per the B5 standing rule).
- `20260926130100_phase2_audit_log_and_batch_rpcs.sql` — `audit_action`/`audit_target_kind` enums; `audit_logs` table (RLS enabled+forced, **zero client-role grants at all** — not even SELECT; reading it is explicitly Phase 8A scope, not built here); `create_batch(...)` (atomic batch + owner-membership creation, security.md §5.2.1 — no audit row, since creation is not a "settings change"); `update_batch_settings(...)` (admin+ only, resolved via `my_batch_role`, writes exactly one audit row with before/after JSON in the same transaction). Both `SECURITY DEFINER`, `EXECUTE` granted to `authenticated` only.
- `20260926130200_phase2_shared_batch_profile_visibility.sql` — two **additive** SELECT policies (Postgres OR-combines multiple permissive policies): `profiles_select_shared_batch` and `avatars_select_shared_batch` on `storage.objects`, both keyed off `my_batch_role()`. Phase 1's self-only policies are untouched.
- **Deliberately deferred**, per database.md's own design and matching precedent (`profiles.avatar_path`-style incremental columns): `batches.cover_media_asset_id` (needs `media_assets`, Phase 4A) and `batch_members.invite_id` + its composite FK to `batch_invites` (needs that table, Phase 3A). Every other column/constraint database.md specifies for these two tables exists now.
- `types/database.ts` regenerated via `supabase gen types typescript --linked`.

**Backend:**

- `lib/authz/roles.ts` — the `BatchRole` type and `hasAtLeastRole()`, mirroring `batch_role`'s declared ascending order exactly (member < moderator < admin < owner). Layer 2 only, never trusted as the boundary.
- `features/batches/` — `schema.ts`, `types.ts`, `queries.ts` (`listMyBatches()` — the switcher's data source; `getBatchById()`), `actions.ts` (`createBatchAction` → `create_batch` RPC, redirects into the new batch; `updateBatchSettingsAction` → `update_batch_settings` RPC), `permissions.ts` (`canEditBatchSettings`), `components/` (`CreateBatchForm`, `BatchSettingsForm`).
- `features/memberships/` — `types.ts`, `queries.ts` (`listBatchMembers()` — RLS decides full-roster-vs-own-row-only; `getMyMembership()`), `permissions.ts` (`canManageMembers`, unused until Phase 3B). No `actions.ts` yet — owner bootstrap happens inside `create_batch`, not a separate memberships write.
- `features/profiles/queries.ts` extended — added `getProfilesByIds()` and `getAvatarUrl()` (generalized from the existing `getOwnAvatarUrl()`), the exported reads `features/memberships` uses to resolve co-members' display info, so no other module queries `profiles` directly (architecture §17).
- `components/ui/select.tsx` — a plain vendored `<select>` for the join-policy field. `components/ui/not-available.tsx` — the one shared "can't show this" state (design.md §20; security.md §3), used identically for "batch doesn't exist" and "not authorized."

**Frontend:**

- `/home` — now the batch switcher (PRD §16; design.md §15): empty state with a "Create your batch" CTA, or a list of the caller's batches with role shown, plus "create another batch."
- `/batches/new` — creation form (name, institution, course, department, graduation year, section, description, join policy).
- `/batches/[batchId]` — batch home: identity, a static "🔒 Private" badge (visibility has exactly one legal value — never exposed as an editable field), links to Members and (admin+ only) Settings.
- `/batches/[batchId]/members` — roster ("member list basics"): avatar-or-initial, display name, role. Uses the real co-member avatar Storage policy, not a placeholder.
- `/batches/[batchId]/settings` — admin+-only settings form (page-level guard is Layer 2 convenience; `update_batch_settings` enforces the same ceiling database-side regardless).
- Audit-log **viewing** UI is explicitly **not** built — `phases.md` Phase 8A owns "Audit-log view for admin+ of that batch only." Phase 2 writes the audit row; nothing reads it yet, by design.

### Tests written and gates actually executed (all against the real hosted `BatchVault-Dev` project)

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | **PASS** |
| Typecheck | `pnpm typecheck` | **PASS** |
| Unit tests | `pnpm test:unit` | **PASS** — 23 tests |
| Adversarial DB suite | `pnpm test:db` | **PASS** — 88 tests, 6 files (`batches.test.ts` new: 38 tests; plus Phase 0/1's five files, two of which needed real fixes for what Phase 2 legitimately creates — see below) |
| Production build | `pnpm build` | **PASS** |
| Client artifact scan | `pnpm test:artifacts` | **PASS** — 3 tests, re-run with the real service-role key visible, on a fresh post-Phase-2 build |
| Dependency audit | `pnpm audit --prod --audit-level high` | **PASS** — no known vulnerabilities |
| Playwright E2E | `pnpm test:e2e` | **PASS** — 34 passed, 2 explicitly-named skips (the same pre-existing, quota-guarded "check-your-email" skip from Phase 1 — unrelated to this phase). New: `batch-creation-flow.spec.ts` (create → land as owner → roster → settings save), on both projects |

**New test files:** `tests/db/batches.test.ts` (anon/non-member denial on `batches`/`batch_members`; **the single most important negative test** — a caller cannot insert their own `batch_members` row by supplying a batch id; every write on both tables refused as RPC-only; roster visibility — active member sees the full roster including a seeded pending row, the pending requester sees only their own row and cannot see the batch itself at all; cross-batch isolation, including a user active in two batches seeing exactly those two; `my_batch_role` returning the real role, returning identical NULL for a stranger regardless of whether the batch is real or fabricated (oracle test), and refusing anon; `create_batch` atomicity — batch + owner row together, and no audit row for plain creation; `update_batch_settings` — admin+ succeeds, member/non-member/wrong-batch-owner/anon all refused identically, and exactly one audit row with before/after JSON on success; `audit_logs` — zero client access of any kind, to anyone, for any operation; the new shared-batch `profiles` policy — co-member visible, non-member and pending-member not; the new shared-batch avatar Storage policy, proven over real HTTP). `tests/e2e/batch-creation-flow.spec.ts`.

**Real defects the gates caught and this session fixed, not worked around:**

1. **Two stale phase-boundary test assertions**, the same category Phase 1 hit: `foundation-migrations.test.ts` asserted `batches`/`batch_members`/`audit_logs` must not exist; `storage-buckets.test.ts` asserted exactly the four Phase-1 avatar policy names with nothing else. Both updated for what Phase 2 legitimately creates (not weakened).
2. **A missing `profiles` fixture row.** `batches.created_by` carries a real FK to `profiles`; disposable Auth users have no profile row by default (mirrors exactly the reason Phase 1 needed its own profile-row fixture). Fixed by seeding one per test user, sequentially.
3. **A `pg.Client` concurrency bug in the test's own fixture setup** (`Promise.all` issuing concurrent queries on one non-pooled connection — `pg` deprecation-warns and does not guarantee correctness here). Fixed by seeding sequentially; caught before it could produce a flaky, order-dependent failure.
4. **Two wrong test expectations, not implementation bugs**: two "anon reads return empty rows" assertions were corrected to "anon reads are refused at the privilege level" (`42501`) — matching the actual, *more* restrictive design (`batches`/`batch_members` grant `SELECT` to `authenticated` only, not `anon` at all), and matching `profiles.test.ts`'s identical precedent.
5. **A Zod/react-hook-form typing trap**, caught by `tsc`, not by a test: `.transform()` and `.default()` on a schema field make its resolver-inferred INPUT type diverge from its OUTPUT type, which breaks `zodResolver`'s type against `useForm<z.infer<...>>`. Fixed by keeping `graduationYear` a plain string end-to-end in the form schema (converted to a number once, in `actions.ts`, right before the RPC call) and moving `joinPolicy`'s default into `useForm`'s `defaultValues` instead of the schema.
6. **A generated-type gap for RPC arguments**, also caught by `tsc`: `update_batch_settings`'s SQL parameters have no `default`, so `supabase gen types` marks every argument required and non-null — even though the underlying columns are genuinely nullable and the function legitimately needs to clear one back to `NULL`. This is a real, narrow generator limitation (it does not do this for table columns, which correctly show `| null`), not a runtime restriction. Resolved with one documented, narrow type assertion at the single call site (rules.md §3's tolerated exception) rather than working around it by sending empty strings instead of `NULL`.

**Known, accepted, honestly documented:**

- The two batch-creation E2E tests each create one real batch on the hosted dev project via the UI (not raw SQL). `deleteUser()` in `afterAll` deletes the Auth user, which cascades the `batch_members` row (`profile_id` is `ON DELETE CASCADE`) but **not** the `batches` row itself (`created_by` is `ON DELETE SET NULL`, by design — database.md §12, so one departing member can never tear a hole in a shared batch's history). Net effect: each E2E run leaves one orphaned (`created_by = NULL`) test batch on the hosted dev project. Harmless on a non-production dev project and not a residue-hygiene violation of the kind B2's disposable-probe rules govern (those were about probe *schema objects*, not applicat­ion data a real E2E flow legitimately creates) — but worth knowing before assuming the dev project's `batches` table is empty. No batch-deletion capability exists yet to clean these up (that's Phase 8B).
- `visibility` (`batch_visibility`) is not exposed as a setting anywhere in the UI or either RPC's parameter list — there is exactly one legal value today (ADR-12), so nothing to choose. Shown as a static "🔒 Private" badge instead.
- Audit-log **read** access (RPC or UI) is not built — correctly deferred to Phase 8A per `phases.md`'s own scope split, even though the *write* path (inside `update_batch_settings`) exists now and is tested.

### memory.md update

Phase 2 complete; `batches`/`batch_members`/`audit_logs` shipped; Q1 resolved; the membership-predicate helper's verified execution model (unchanged from B2 — `SECURITY DEFINER` owned by the `BYPASSRLS`-holding `postgres` bypasses RLS entirely, so the helper's and both RPCs' own checks are the only boundary) is exercised, not re-investigated, by this phase's own RPCs and tests.

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

MVP tables: `profiles` (**implemented, Phase 1**), `batches`, `batch_members`, `audit_logs` (**implemented, Phase 2** — `batches.cover_media_asset_id` still deliberately deferred to Phase 4A), `batch_invites` (**implemented, Phase 3A** — `batch_members.invite_id` added by this phase too). Planned, not yet implemented: `memories`, `media_assets`, `comments`, `reactions`, `reports`. **Implementation-only, not a `database.md` MVP table:** `invite_redemption_attempts` (Phase 3A) — rate-limit bookkeeping only, see "Phase 3A" above.

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

Per `phases.md`:

- Phase 0 — Foundation — **COMPLETE**
- Phase 1 — Authentication & Profile — **COMPLETE** (see above)
- Phase 2 — Batch Spaces — **COMPLETE** (see above)
- Phase 3A — Invitations & Join — **COMPLETE** (see above)
- Phase 3B — Membership Decisions & Roles — **COMPLETE** (see above)
- Phase 4A — Photo Upload Pipeline
- Phase 4B — Video Constraints, Edit/Delete & Media Reliability
- Phase 5A — Gallery & Memory Detail
- Phase 5B — Timeline & Event Grouping
- Phase 6 — Comments & Reactions
- Phase 7 — no MVP scope (time capsules and yearbook are post-MVP)
- Phase 8A — Reporting, Moderation & Audit Visibility
- Phase 8B — Batch & Account Lifecycle (gated — see Known Issues below)
- Phase 9 — Quality & Production Readiness

**Current implementation phase: Phase 3B, COMPLETE** — Phase 0 is complete and committed (`c8ae566`); Phase 1 is complete and committed (`0408fbf`); Phase 2's, Phase 3A's, and Phase 3B's migrations are all applied to the hosted dev project; every Phase 3B gate scoped to this phase has been executed and observed passing; `docs/memory.md` is updated. **Nothing has been committed for Phase 2, 3A, or 3B** — this session was told not to commit. Phase 4A begins only on explicit instruction, and only once B1, Q4, R1, R2 are decided (none are yet — see "Known Issues / Open Decisions" below).

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

**Commit Phase 2, Phase 3A, and Phase 3B**, then **Phase 4A — Photo Upload Pipeline** only on explicit instruction.

Phase 2, Phase 3A, and Phase 3B are all complete (see their sections above). Nothing has been committed for any of the three yet — this session was told not to commit.

**Phase 4A is gated, unlike 3B was.** Its hard prerequisites per `phases.md` — **B1 (EXIF/GPS), Q4 (image derivative strategy), R1 (signed-URL TTL), R2 (private-media-vs-optimizer delivery)** — are all still open (see "Known Issues / Open Decisions" below). None may be silently resolved; each updates its source document first. Do not begin Phase 4A until all four are decided.

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

STOP — **Phase 0 / Prompt 12 is COMPLETE** (committed `c8ae566`). **Phase 1 / Prompt 13 is COMPLETE** (committed `0408fbf`). **Phase 2 / Prompt 14 is COMPLETE** (2026-09-26): `batches`, `batch_members`, `audit_logs`, the `my_batch_role` membership predicate, and the `create_batch`/`update_batch_settings` RPCs are live on the hosted `BatchVault-Dev` project; `features/batches` and `features/memberships` (read side) are fully implemented; `lib/authz` role hierarchy implemented. **Phase 3A / Prompt 15 ("Phase 3A" section) is COMPLETE** (2026-10-18): `batch_invites`, `invite_redemption_attempts`, `batch_members.invite_id`, and the `check_invite_rate_limit`/`validate_invite`/`redeem_invite`/`create_invite`/`revoke_invite` functions are live on the hosted `BatchVault-Dev` project; `features/invitations` and the `/invite` landing page are fully implemented. **Phase 3B / Prompt 15 ("Phase 3B" section) is COMPLETE** (2026-10-18): `approve_member`/`reject_member`/`remove_member`/`change_member_role`/`transfer_ownership` and the `profiles_select_pending_review` policy are live on the hosted `BatchVault-Dev` project; `features/memberships`' write side and the members-page approval queue/role controls are fully implemented; a real latent bug in `getOwnProfile()`/`saveOwnProfileAction()` (unfiltered `profiles` queries relying on RLS alone) was found and fixed. Every gate scoped to Phase 3B (lint, typecheck, build, unit — 15 new, adversarial DB — 32 new, the new membership E2E flow, and a re-run of Phase 3A's own E2E flow to confirm no regression) was executed against the real project and observed passing; `docs/memory.md` is updated. **Nothing has been committed for Phase 2, 3A, or 3B** — this session was told not to commit. **Next Task: commit all three, then Phase 4A — Photo Upload Pipeline only on explicit instruction, and only once B1/Q4/R1/R2 are decided** (see "Next Task" above).
