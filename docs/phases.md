# BatchVault — Development Phases

Status: Draft — MVP execution roadmap
Sources of truth: `/docs/project-context.md`, `/docs/PRD.md`, `/docs/architecture.md`, `/docs/database.md`, `/docs/security.md`, `/docs/rules.md`, `/docs/design.md`
Prepared per: `/prompts/08_PHASES.md`

**What this document is.** The execution roadmap. It sequences already-decided work into small, testable phases. It implements nothing, and it introduces no product, architecture, database, security, or design decision that the seven source documents do not already establish. Where anything here conflicts with those documents, they win and this document is wrong.

**Source-of-truth rule (binding on every later prompt).** Documentation beats filenames. Several implementation prompt files (12–21) carry names that imply scope the source documents place **post-MVP**. Those filenames do **not** expand MVP scope. An implementation prompt must follow `phases.md` and the source documents; where a prompt's name or body suggests building something this document marks post-MVP, the correct action is to **not build it** and to say so (rules.md §6, rules 5 and 7). See §"Prompt-Pack Mapping and Conflicts."

**Post-MVP, not scheduled here** (architecture §16, §22; database.md §1.2; PRD §15; project-context §11–12): albums, notifications, time capsules, yearbook, public showcase, advanced search/discovery, richer media processing/transcoding, and any AI feature. Boundaries are preserved (§"Post-MVP Boundaries"); behavior is not designed or built in any MVP phase.

---

## Core Loop the MVP Phases Must Preserve

```
signup → profile/onboarding → create batch → invite classmates
  → join/request membership → upload memories/media
  → gallery/timeline/detail → comments/reactions
  → moderation/privacy → production readiness
```

Phase coverage of that loop: signup + onboarding (Phase 1) → create batch (Phase 2) → invite + join/approval (Phase 3) → upload media (Phase 4) → gallery/timeline/detail (Phase 5) → comments/reactions (Phase 6) → moderation/privacy (Phase 8) → production readiness (Phase 9). Phase 0 is foundation; **Phase 7 carries no MVP scope** (see §"Phase 7").

---

## Standing Rules for Every Phase

These are not restated inside each phase; they always apply.

1. **RLS is enabled and `FORCE ROW LEVEL SECURITY` in the same migration that creates the table** — never a follow-up migration, never "policies later" (security.md §5.1; rules.md §1.4).
2. **New tables start deny-by-default**; access is added deliberately, per-command, per security.md §5.4's table-by-table intent.
3. **High-risk writes are RPC-only**, never direct client DML, for exactly the operations in security.md §5.2: batch creation + initial owner membership, invite creation, invite redemption / membership creation, membership approval / rejection / removal, role changes, ownership transfer, media preallocation, media finalize, report creation, audit-log insertion, batch deletion / restoration. `database.md` and `security.md` define the **required invariants**, not final SQL function names or signatures — each phase creates narrow RPCs that enforce the documented invariants (rules.md §1.3).
4. **Every direct-DML path gets column-level enforcement** (security.md §5.4.1) — row-level policy alone is never sufficient for a writable table.
5. **All Storage buckets are private; paths are server-generated/preallocated**; the client never chooses or influences a path (architecture §7–8; security.md §6).
6. **Order of operations in every Server Action / Route Handler**: authenticate → validate (Zod) → authorize → execute → revalidate → return (architecture §18.3; rules.md §1.2).
7. **Quality gates must actually run and pass** (below). A phase is never "done" on the strength of this plan saying tests should run (rules.md §6 rule 6, §8 rule 7).
8. **Scope discipline**: implement only the current phase. No future-phase features "while already here," no unrelated refactors (rules.md §3, §6 rules 7 and 9).

### Quality Gates (applicable subset must pass, with observed output)

| Gate | Applies |
|---|---|
| `pnpm lint` | Every phase |
| TypeScript typecheck (strict) | Every phase |
| Vitest (unit/integration) | Every phase |
| Playwright (E2E) | Every phase with a user-facing flow (1–6, 8, 9) |
| Production build (`next build`) | Every phase |
| `pnpm audit` (high-severity fails) | Every phase |
| **Adversarial RLS / RPC / Storage tests** (security.md §5.6, §7.1) | Every phase that creates a table, policy, RPC, or Storage path (0–4, 6, 8, 9) |
| Accessibility + reduced-motion verification (design.md §25–29) | Every phase shipping UI |

**Never report a gate as passing unless it was executed in that session and its real output was read.** If a gate was not run, say so explicitly.

---

## Decision Gates — Blockers and Open Decisions, Mapped to the Phase They Must Precede

No phase may **start** past its "must be resolved before" marker with the gate unresolved, and no phase may **ship** past a release gate with one open. Nothing in this table is decided here.

| # | Gate | Source | Must be resolved before |
|---|---|---|---|
| **B2** | **Privileged-function execution model**: `SECURITY DEFINER` / `FORCE RLS` / function-owner behavior **verified in the real Supabase environment**; membership-helper recursion design proven | security.md §32 B2, §5.2.2, §5.3 | **Phase 0 deliverable; hard entry prerequisite for Phase 2.** Nothing that relies on a privileged RPC or a membership-helper-dependent policy may be written until this is proven and written down |
| Q1 / PRD #1–2 | Default `join_policy`; whether approval is owner-configurable or fixed | database.md Q1; PRD §"Unresolved" 1–2 | Phase 2 (the `batches` column default) and Phase 3 (approval flow) |
| Q4 / arch §9 | Image derivatives: Storage transformations **(a)** vs. generated derivatives **(b)** | database.md Q4; architecture §9 | **Phase 4A** — (b) adds `media_assets` rows and changes finalize |
| **R2** | Private media vs. image optimization: a cached media response must never outlive the viewer's authorization | security.md R2; architecture risk #3 | **Phase 4A** (delivery design), re-verified Phase 5A |
| **R1** | Signed-URL TTL choice (a security decision, not a performance one) | security.md §8, R1 | Phase 4A |
| **R9** | **Media response headers from Supabase Storage verified** (`nosniff`, disposition on Storage-served bytes) | security.md §15, R9 | Verification task in **Phase 4A**; hard **release gate in Phase 9** |
| **B1** | **EXIF / GPS handling** — one of the four §27 options chosen deliberately | security.md §32 B1, §27 | **Decision before Phase 4A implementation** (two options change the upload pipeline); hard **release gate in Phase 9** |
| R6 | HEIC exclusion needs a product answer or iPhone users hit a wall | security.md R6, §15 | Phase 4A (UX copy/path), revisited Phase 9 |
| Q5 | Distinguishing stated vs. defaulted `occurred_on` | database.md Q5 | Phase 4A (write) / Phase 5B (display) |
| PRD #7 | Whether a member may edit/delete their own memory, and any time limit | PRD §"Unresolved" 7 | Phase 4B |
| Q2 / PRD #3 | Reaction `kind` allowlist (single vs. small fixed set) | database.md Q2; PRD §"Unresolved" 3 | **Phase 6** |
| PRD #5 | Retention policy for removed/reported content | PRD §"Unresolved" 5; database.md §24 | Phase 8A (reaping windows) |
| PRD #6 | Batch-deletion mechanics (immediate vs. grace period) | PRD §"Unresolved" 6; PRD §18 | Phase 8B |
| **B3 / Q3** | **Owner account deletion** — block pending transfer, auto-promote, or claimable ownerless state | security.md §32 B3; database.md Q3 | **Phase 8B — the account-deletion flow must not ship without it** |
| Q7 | Audit rows after batch hard-delete (`batch_id` becomes NULL) | database.md Q7 | Phase 8B |
| **R10 / Q9** | **Export scope and format** — must precede implementation, not emerge from it | security.md §25, R10; database.md Q9 | **Phase 8B — no export surface is built until scope is decided.** This document does not decide it |
| **B4** | **Platform-level moderation path** for a hostile owner / illegal content | security.md §32 B4, §19 | Designed alongside Phase 8A; hard **release gate in Phase 9** |
| R3 | No MFA / step-up auth; re-authentication before destructive actions | security.md R3, §2, §24 | Phase 8B |
| R4 | Account deletion does not delete contributions — wording + legal review | security.md R4, §22 | **Release gate in Phase 9** |
| Q8 | Locked time-capsule visibility | database.md Q8 | Post-MVP only — not an MVP gate |

---

## Phase 0 — Foundation

**Prompt file:** `12_PHASE_0_FOUNDATION.md`

**Objective.** Stand up the repository, toolchain, environments, migration framework, CI gates, and the private Storage buckets — and **prove the privileged-function execution model (B2)** — so that every later phase builds on a verified base.

**Prerequisites.** None (first phase).

**In scope.**
- Next.js App Router + strict TypeScript project; Tailwind CSS; shadcn/ui vendored into `components/ui`; Lucide React; Framer Motion with the shared reduced-motion wrappers in `components/motion` (architecture §16; design.md §28–29).
- pnpm as the only package manager; committed `pnpm-lock.yaml` (rules.md §2).
- Folder skeleton exactly per architecture §16, including **empty reserved directory boundaries** for `albums`, `notifications`, `time-capsules`, `yearbook` (boundaries only — no code, no schema, no route).
- Validated typed environment module with split server/client schemas; service-role client isolated in one server-only module (architecture §15; security.md §12).
- Separate Supabase projects for local / preview / production (architecture §15).
- Migration framework + the single shared `set_updated_at()` housekeeping function (database.md §11).
- Private Storage buckets for **batch media** and **avatars**, created with **no permissive policies** (deny-by-default). The future showcase bucket is **not** created (ADR-12).
- CI running the full gate set; Vitest and Playwright harnesses wired up.
- Base design tokens expressing design.md §4–9 (color roles, light/dark, type scale, spacing, radius, elevation).

**Explicitly NOT in scope.** No application tables. No auth flows. No feature modules implemented. No album/notification/capsule/yearbook/showcase code. No AI. No export. No email provider.

**User stories.** None user-facing. (Developer story: "a new session can clone, install, run, and see all gates pass.")

**Database changes.** Migration tooling and the shared `updated_at` trigger function only. No application tables.

**Security work.**
- **B2 verification spike (the gate for this phase):** in the real Supabase environment, prove how `SECURITY DEFINER`, function ownership, and `FORCE ROW LEVEL SECURITY` actually interact; choose the owner/execution model deliberately; write the result down. Include the negative test that the membership helper cannot become an oracle for batches the caller is not in (security.md §5.3, §32 B2).
- Build-time check that the service-role key appears in no client artifact (security.md §12).
- Confirm no bucket is public.

**Backend deliverables.** Env module; Supabase user-scoped + service-role client modules; migration pipeline; `lib/authz` and `lib/logging` skeletons (no domain logic).

**Frontend deliverables.** App shell, theme provider (system-preference default per design.md §5), base primitives, skip-to-content, focus-ring treatment (design.md §27).

**Tests that must actually run.** `pnpm lint`; typecheck; Vitest (env-schema and utility coverage); Playwright smoke (app boots); `next build`; `pnpm audit`; the **B2 verification tests** above.

**Acceptance criteria.** All gates pass in CI; three environments resolve independently; the B2 model is verified and documented; no public bucket exists; the service-role key is absent from client output.

**Definition of done.** The above, plus the folder structure matching architecture §16 and no feature code present.

**Git checkpoint.** One commit: `chore: phase 0 foundation` (or equivalent conventional-commit), made only after gates pass.

**memory.md update (once it exists, from Prompt 10).** Current phase → Phase 0 complete; record the **B2 outcome** as a durable decision; list gates wired; note open decision gates carried forward.

**STOP boundary.** STOP after Phase 0. Do not create `profiles` or any auth flow. Phase 1 begins only on explicit instruction.

---

## Phase 1 — Authentication & Profile

**Prompt file:** `13_PHASE_1_AUTH_PROFILE.md`

**Objective.** A user can sign up, verify, sign in and out, reset a password, complete profile onboarding, and reach protected routes — with `profiles` protected at the database and column level.

**Prerequisites.** Phase 0 complete, including the B2 outcome documented.

**In scope.**
- Supabase Auth via the supported SSR cookie/session strategy; middleware session refresh (architecture §4).
- Signup, email verification, login, logout, password reset — **provider-owned flows wired up**, not custom crypto or a custom session store (security.md §2).
- Profile onboarding (display name, optional avatar, bio) gated by `profiles.onboarding_completed_at` (database.md §3.1; PRD §9.2).
- Server-side route protection for authenticated route groups (architecture §4).
- Own-avatar upload through a controlled flow with a **server-composed** path `{profile_id}/{asset_id}` (security.md §6.1).
- Forms via React Hook Form + Zod, with independent server-side Zod validation (rules.md §1.6; design.md §14).

**Explicitly NOT in scope.** No batches, memberships, invites, memories, comments, reactions, or moderation. **No cross-member avatar visibility yet** — that rule becomes live in Phase 2 when `batch_members` exists. No MFA (security.md R3). No notifications.

**User stories.** As a new user I can create an account, verify my email, and complete my profile. As a returning user I can log in, log out, and reset my password. As a signed-out visitor I cannot reach an authenticated route.

**Database changes.** `profiles` (+ RLS enabled and forced in the creating migration), including the `id = auth.uid()` insert binding and the writable-column set `display_name`, `bio` only (security.md §5.4.1).

**Security work.**
- Column-level enforcement on `profiles`: `id` immutable on update, and `avatar_path`, timestamps, `deleted_at`, `onboarding_completed_at` not client-writable (security.md §5.4.1).
- `avatar_path` set only by the controlled upload flow or database-constrained to a caller-owned, server-generated path whose first segment equals `auth.uid()`.
- Avatar Storage policy: **self only** at this phase.
- Redirect-target allowlisting on the auth callback (security.md §13).

**Backend deliverables.** `features/authentication` and `features/profiles` (actions/queries/schema/types/permissions); session helpers in `lib/auth`.

**Frontend deliverables.** Auth screens and onboarding steps per design.md §14 (short mobile-first steps), §19–21 states, §25–27 accessibility.

**Tests that must actually run.** All standard gates, plus adversarial tests from security.md §5.6: one authenticated user attempting to **INSERT a profile row whose `id` is another auth user's id**; a profile owner attempting to rewrite `id`, `deleted_at`, or other system fields; a profile owner attempting to set `avatar_path` to **another profile's** object and to an arbitrary path; an unauthenticated read of `profiles`. Playwright E2E for signup → verify → onboarding → protected route → logout.

**Acceptance criteria.** PRD §22 criterion 1 is met; every adversarial test above fails closed; onboarding gates batch access.

**Definition of done.** The above with gates observed passing, and generic user-facing errors that never disclose resource existence (security.md §3; design.md §20).

**Git checkpoint.** `feat: phase 1 authentication and profile`.

**memory.md update.** Phase 1 complete; `profiles` shipped with its writable-column set; note that co-member avatar visibility is deferred to Phase 2.

**STOP boundary.** STOP after Phase 1. Do not create `batches` or `batch_members`. Phase 2 begins only on explicit instruction, and only with **B2 signed off**.

---

## Phase 2 — Batch Spaces

**Prompt file:** `14_PHASE_2_BATCHES_MEMBERSHIP.md`

**Objective.** An onboarded user can create a private batch that comes into existence **together with its owner membership**, view it, and change its settings — with the membership predicate and audit trail in place.

**Prerequisites.** Phase 1 complete. **B2 verified (hard gate).** Q1 / PRD #1–2 decided (the `join_policy` default this phase encodes).

**In scope.**
- Atomic **create-batch-with-owner** RPC: derives the creator from `auth.uid()`, inserts the batch and the owner `batch_members` row, commits both or neither (security.md §5.2.1).
- Batch identity and settings (name, institution, course, department, graduation year, section, description, visibility, join policy) — admin+ settings changes via RPC (PRD §9.4–5, §9.19).
- The **membership helper function** and `lib/authz` role hierarchy mirroring it (architecture §5, §17; database.md §15; security.md §5.3).
- Batch-scoped read policies for `batches` and `batch_members`; the roster visible to members, and a pending requester seeing **only their own row** (security.md §5.4).
- Extending the avatar read rule to co-members of an active shared batch (security.md §6.1).
- Audit logging for batch settings changes, written in-transaction by the performing function (security.md §20; database.md §21).
- Batch home/identity UI and a batch switcher for multi-batch users (PRD §16; design.md §15).

**Explicitly NOT in scope.** **No invites, no join requests, no approval, no role changes, no ownership transfer, no member removal** (all Phase 3). No memories, media, comments, reactions, reports. No batch deletion (Phase 8B). No discovery, search, or directory — batches are not discoverable (security.md §10).

**User stories.** As an onboarded user I can create a batch and become its owner. As an owner/admin I can edit batch identity and settings. As a member I can see my batch and its roster. As a non-member I cannot see that the batch exists.

**Database changes.** `batches`, `batch_members`, `audit_logs` — each with RLS enabled and forced in its creating migration; the partial unique index enforcing **at most one active owner**; `UNIQUE (batch_id, profile_id)`; `UNIQUE (id, batch_id)` composite-FK targets; `audit_logs` append-only by privilege, with no client `UPDATE`/`DELETE` grant (database.md §3.2–3.3, §3.10, §14).

**Security work.**
- No direct client `INSERT` on `batches` or `batch_members` — privilege revoked, not merely policy-restricted (security.md §5.2).
- Membership helper constrained per security.md §5.3: current-caller only, no user-id parameter, schema-qualified, pinned safe `search_path`, no dynamic SQL, `STABLE`, minimum `EXECUTE` grants.
- Deny-by-default reads for non-members; indistinguishable denial (security.md §3).

**Backend deliverables.** `features/batches`, `features/memberships` (read side + owner bootstrap only), `lib/authz`.

**Frontend deliverables.** Batch creation flow, batch home, settings forms (RHF + Zod), roster view — per design.md §12–15, §22–24.

**Tests that must actually run.** All standard gates, plus: **a user attempting a direct PostgREST `INSERT` into `batch_members` supplying a batch id — the single most important negative test in the suite** (security.md §5.6); a member of batch A attempting to read or insert against batch B; a non-member reading `batches`, `batch_members`, `audit_logs`; the membership helper probed as an oracle; an attempt to `UPDATE`/`DELETE` an audit row; an attempt to create a batch without an owner (must be impossible); cross-batch isolation for a user in two batches.

**Acceptance criteria.** PRD §22 criterion 2 met; no batch can exist without an active owner; every negative test above fails closed.

**Definition of done.** The above with gates observed passing and the audit trail recording settings changes.

**Git checkpoint.** `feat: phase 2 batch spaces`.

**memory.md update.** Phase 2 complete; record the Q1 decision; note the membership helper's verified execution model.

**STOP boundary.** STOP after Phase 2. Do not build invites, join, approval, or role changes. Phase 3 begins only on explicit instruction.

---

## Phase 3 — Invitations, Join Flow & Membership Management

**Prompt file:** `15_PHASE_3_INVITES_JOIN.md`
Split into two sub-phases so one session handles one coherent unit.

### Phase 3A — Invitations & Join

**Objective.** An owner/admin can issue a shareable invite link; a recipient can redeem it and either join or land in a pending queue, per the batch's join policy.

**Prerequisites.** Phase 2 complete. Q1 / PRD #1–2 decided.

**In scope.**
- Invite creation RPC: server-generated ≥256-bit CSPRNG token, **only a SHA-256 hash stored**, with `expires_at`, `max_uses`, revocation (security.md §9; database.md §3.4).
- **Atomic redemption RPC** under a row lock: computed validity (not a stored status), `use_count` increment, join-policy resolution, and `role = 'member'` hard-coded — an invite can never confer a privileged role (database.md §3.4, §16).
- Invite link handling that keeps the **raw token out of every logging position**: token travels in the **URL fragment**, is **POSTed** to the redemption endpoint, and the visible URL is replaced afterward (security.md §9.1).
- Invite landing page showing the **batch name only**, after the token validates (security.md §9; design.md §35).
- A removed member redeeming a fresh link does **not** silently rejoin (security.md §9).
- Rate limiting on redemption, per IP and per account (security.md §17).

**Explicitly NOT in scope.** **No email delivery and no transactional email provider** — invites are user-shared links (architecture §12, ADR-08b). No batch discovery or public join. No role changes or removal (3B). No notifications.

**User stories.** As an owner/admin I can create, copy, and revoke an invite link. As a recipient I can redeem a valid link and join, or become pending when approval is required. As a holder of an expired/revoked/invalid link I get one indistinguishable generic response.

**Database changes.** `batch_invites` (RLS enabled and forced; `UNIQUE (token_hash)`; `UNIQUE (id, batch_id)`), and the composite invite-provenance FK on `batch_members` (database.md §3.3–3.4).

**Security work.** `token_hash` not selectable by any client role (column privilege, security.md §9). No client DML on invites or memberships. Generic response for every invalid-token case, revealing nothing about existence or batch. Verify no analytics/error breadcrumb captures the full invite URL.

**Backend deliverables.** `features/invitations`; redemption route accepting the token by **POST body only**.

**Frontend deliverables.** Invite creation/copy/QR-share surface, invite landing, pending-state screen (design.md §19–21, §35).

**Tests that must actually run.** All standard gates, plus: **pending membership conveys zero access** (no gallery, roster, or media); a removed member redeeming a fresh link is not reactivated; concurrent redemption of a single-use link succeeds exactly once; token enumeration yields one generic response; `token_hash` unreadable by a client role; direct DML on `batch_invites` refused at the privilege level; a self-created membership attempt refused (carried forward from Phase 2).

**Acceptance criteria.** PRD §22 criterion 3 met for the invite/redeem path; redemption never bypasses the approval gate.

**Definition of done.** The above with gates observed passing, and no raw token present in any log, path, or query string.

**Git checkpoint.** `feat: phase 3a invitations and join`.

**memory.md update.** Phase 3A complete; note the token-handling design and rate limits.

**STOP boundary.** STOP after Phase 3A. Do not build approval decisions, role changes, or removal. Phase 3B begins only on explicit instruction.

### Phase 3B — Membership Decisions & Roles

**Objective.** Authorized roles can approve/reject join requests, remove members, and change roles; an owner can transfer ownership — all with rank ceilings enforced database-side and audited.

**Prerequisites.** Phase 3A complete.

**In scope.**
- Narrow RPCs for `approve`, `reject`, `remove`, each validating the legal transition from the target's current status — **no caller-supplied `membership_status`** (security.md §11).
- Role changes honoring the §4 capability matrix and §11 ceilings: the actor's role is resolved from `batch_members`, never accepted from input; an actor may assign only roles strictly below their own authority; no self-escalation.
- **Ownership transfer** as one atomic operation to a named active member, demoting the outgoing owner in the same transaction, audited as `ownership_transferred` (security.md §11; database.md §13).
- Member list with pending-approval queue; removal is a status transition, never a row delete (database.md §12).
- Audit rows for every decision, with `actor_role` frozen at the time of action (security.md §20).

**Explicitly NOT in scope.** No batch deletion (8B). No account deletion (8B, gated on B3). No content moderation (8A). No platform-level operator tooling (B4, gated at Phase 9).

**User stories.** As an owner/admin/moderator I can approve or reject a pending request. As an owner/admin I can promote/demote within my authority. As an owner I can transfer ownership. As a moderator I cannot act on an admin or the owner.

**Database changes.** No new tables — status/role transitions on `batch_members` plus audit rows.

**Security work.** Rank ceilings enforced on both actor and target; exactly-one-active-owner preserved structurally; no self-role change except as a consequence of the dedicated transfer transaction.

**Backend deliverables.** `features/memberships` write side.

**Frontend deliverables.** Member management and approval queue in the same warm card/list language — **not a dashboard table** (design.md §15, §24); destructive and transfer confirmations per design.md §13–16.

**Tests that must actually run.** All standard gates, plus: a member attempting to set their own role; a **moderator attempting to remove an admin**; an **admin attempting to create another admin**; a caller **forging their actor role in the payload** while requesting a legitimate target role; a transfer that would leave two owners (must fail on the constraint); a removed member immediately losing read access; a non-mod+ attempting an approval.

**Acceptance criteria.** PRD §22 criteria 3 and 7 met for membership management; every ceiling test fails closed.

**Definition of done.** The above with gates observed passing and each privileged action audited.

**Git checkpoint.** `feat: phase 3b membership decisions and roles`.

**memory.md update.** Phase 3B complete; note the audited action set now live.

**STOP boundary.** STOP after Phase 3B. Do not begin media or memories. Phase 4 begins only on explicit instruction, and only with **B1, Q4, R1, R2 decided**.

---

## Phase 4 — Memories & Media

**Prompt file:** `16_PHASE_4_MEMORIES_MEDIA.md`
Split into two sub-phases; the photo pipeline must be correct before video constraints are layered on.

### Phase 4A — Photo Upload Pipeline

**Objective.** A member can upload a photo into their batch with a caption, event name, and date, via the two-phase direct-to-Storage flow, and see that it exists.

**Prerequisites.** Phase 3B complete. **B1 (EXIF/GPS option) decided** — two of the four §27 options change this pipeline. **Q4 (derivatives a/b) decided.** **R1 (signed-URL TTL) and R2 (delivery vs. optimizer) decided.**

**In scope.**
- Preallocation RPC: verifies membership, validates declared type/size against policy, inserts a `pending` `media_assets` row, and composes the path **server-side** as `{batch_id}/{media_asset_id}` (architecture §8; database.md §3.6).
- Direct browser-to-Storage upload with progress, cancel, and retry (architecture §8; design.md §18).
- **Finalize RPC**, idempotent per upload identifier: re-verifies membership, confirms the object exists at the path the server issued, enforces **actual stored byte size** (authoritative) and the Storage-reported content type against the allowlist, and writes memory + media metadata in one transaction (architecture §8, §10; security.md §14).
- Rejected finalize → row set `rejected`, **bytes deleted object-first**, row removed once the object is confirmed gone (database.md §3.6).
- Blur placeholder captured at finalize; derivative strategy per the Q4 decision (architecture §9; design.md §11).
- Type allowlist and size caps enforced server-side; **no SVG** (security.md §15–16).
- A minimal verification list proving the memory landed (architecture §8 step 5) — deliberately unpolished; the real gallery is Phase 5A.

**Explicitly NOT in scope.** **No video** (4B). No transcoding, no adaptive bitrate, no `ffprobe`-class inspection (architecture §10, ADR-08a). No albums. No comments/reactions. No client-side authoritative validation. No memory edit/delete (4B).

**User stories.** As a member I can pick a photo, add a caption/event/date, watch it upload, and confirm it is in my batch. As a member I cannot upload into a batch I am not in.

**Database changes.** `memories` and `media_assets` (RLS enabled and forced), including `occurred_on date NOT NULL`, the readiness CHECK, `UNIQUE (storage_path)`, the deferrable `UNIQUE (memory_id, position)`, the composite same-batch FKs, and the gallery index (database.md §3.5–3.6, §10).

**Security work.**
- **Storage RLS must reflect database visibility, not merely membership** (security.md §7.1): `ready` media readable only when the caller is an active member, the batch is not soft-deleted, `media_assets.deleted_at IS NULL`, and the parent memory exists and is visible; `pending` readable only by its uploader; `rejected` never generally readable.
- Storage write scoped to a single server-preallocated `pending` row owned by the caller; **a `ready` object cannot be overwritten**; ordinary members hold **no Storage delete** (security.md §6.2).
- Column-level enforcement on `memories`: `caption`, `event_name`, `occurred_on` writable; `batch_id`, `created_by`, timestamps, `deleted_at`, `deleted_by` not (security.md §5.4.1).
- Short-TTL signed URLs, never persisted, cached, or logged (security.md §8, §21).
- **R9 verification task:** confirm what Supabase Storage actually returns for each allowed type (content type, `nosniff`, disposition) and record it.

**Backend deliverables.** `features/memories`, `features/media` — the only module that talks to Storage (architecture §17).

**Frontend deliverables.** Upload flow as a drawer-based mobile-first moment with the metadata form beside the photo (design.md §14, §18, §22); honest progress and retry states.

**Tests that must actually run.** All standard gates, plus security.md §6.2/§7.1 adversarial Storage tests **called directly by path**: upload to a path the caller did not preallocate; upload to another member's pending media id; upload over an existing `ready` object; a member attempting Storage delete; fetching the object of a soft-deleted or moderator-removed memory; fetching another member's `pending` object; fetching a `rejected` object; fetching an object in a soft-deleted batch; a non-member fetching any object. Plus finalize enforcement of actual size and type, finalize idempotency on retry, and a **memory author attempting to change `batch_id` or `created_by`**.

**Acceptance criteria.** PRD §22 criterion 4 met for photos; every Storage negative test fails closed; no unadmitted bytes persist.

**Definition of done.** The above with gates observed passing, and the R9 finding written down.

**Git checkpoint.** `feat: phase 4a photo upload pipeline`.

**memory.md update.** Phase 4A complete; record the B1, Q4, R1, R2 decisions and the R9 finding.

**STOP boundary.** STOP after Phase 4A. Do not add video, edit/delete, or the gallery. Phase 4B begins only on explicit instruction.

### Phase 4B — Video Constraints, Edit/Delete & Media Reliability

**Objective.** Constrained short-video upload works, members can edit/delete their own memory per the PRD #7 decision, and the orphan/rejected sweep keeps Storage honest.

**Prerequisites.** Phase 4A complete. **PRD #7 decided** (edit/delete rights and any time limit). R6 (HEIC answer) decided for upload UX.

**In scope.**
- `video/mp4` (H.264 + AAC) only, with a hard size cap enforced from actual stored size and a **soft, client-side-only duration cap honestly labeled as UX validation** (architecture §10, ADR-08a; security.md §14).
- Client-captured poster frame uploaded as a companion image; neutral on-brand placeholder when capture fails (architecture §10; design.md §11).
- Progressive playback via short-TTL signed URL; **no transcoding, no HLS/DASH, no live streaming**.
- Author edit of `caption` / `event_name` / `occurred_on` via policy-checked direct DML with the column set from 4A; soft delete of own memory (database.md §12).
- **Vercel Cron sweeps** (idempotent, bounded, service-role, object-first): orphaned `pending` uploads past a grace window, and `rejected` rows purged on the next pass (architecture §13; database.md §24).

**Explicitly NOT in scope.** No authoritative duration/codec verification. No media processing pipeline. No richer transcoding (post-MVP). No moderator removal of others' content (8A).

**User stories.** As a member I can upload a short video and play it back. As an author I can fix a caption or date, and delete my own memory. As an operator, abandoned uploads do not accumulate.

**Database changes.** No new tables; the `(created_at) WHERE status <> 'ready'` sweep index and `(deleted_at) WHERE deleted_at IS NOT NULL` reaping index if not already present (database.md §10).

**Security work.** Cron routes verify a shared secret **before parsing the body** (architecture §18.9); sweep ordering is object-first and idempotent; duration/codec limits are documented as non-guarantees, never described as enforcement (ADR-08a).

**Backend deliverables.** Video branch of `features/media`; cron route handlers under `app/api/cron`.

**Frontend deliverables.** Video upload/playback states; edit/delete with confirmation scaled to blast radius (design.md §13–16).

**Tests that must actually run.** All standard gates, plus: an over-cap video rejected with bytes deleted; a disallowed type rejected; sweep idempotency (running twice is harmless); a sweep run where the object is already absent; an author editing their own memory attempting to change `batch_id`; a non-author attempting to edit or delete someone else's memory; an unauthenticated call to a cron route refused.

**Acceptance criteria.** PRD §22 criterion 4 met for short video; unadmitted bytes never persist; the duration cap is documented as soft.

**Definition of done.** The above with gates observed passing.

**Git checkpoint.** `feat: phase 4b video constraints and media reliability`.

**memory.md update.** Phase 4B complete; record the PRD #7 and R6 decisions.

**STOP boundary.** STOP after Phase 4B. Do not build the gallery, timeline, or detail page. Phase 5 begins only on explicit instruction.

---

## Phase 5 — Gallery, Timeline & Memory Detail

**Prompt file:** `17_PHASE_5_GALLERY_ALBUMS_TIMELINE.md`
**Filename conflict, resolved here: albums are POST-MVP** (architecture §16, §22; database.md §1.2; PRD §15). This phase builds **gallery, timeline, and memory detail only**. The `albums` module stays an empty reserved boundary, and no `albums` / `album_memories` table is created. The implementation prompt must follow this document, not its own filename.

### Phase 5A — Gallery & Memory Detail

**Objective.** The product's core surface: a fast, paginated, photography-first gallery, and a memory detail page showing media, caption, metadata (with comments/reactions arriving in Phase 6).

**Prerequisites.** Phase 4B complete. R2 re-verified for the chosen delivery path.

**In scope.**
- Server-rendered gallery reading through the feature data layer, ordered by `occurred_on DESC, id DESC`, with **keyset/cursor pagination** — never the whole archive (architecture §19; PRD §20; rules.md §2).
- Blur-placeholder-first tiles resolving to a **derivative, never the original** (architecture §9; design.md §11, §30).
- Memory detail: media-dominant layout, caption, event/date, graceful "former member" attribution, progressive video (design.md §32).
- Continuous-feeling tile→detail transition via the shared motion wrappers, fully reduced-motion compatible (design.md §28–30).
- Per-request `Cache-Control: private, no-store` on responses carrying batch content; no shared caching of private HTML (architecture §11).

**Explicitly NOT in scope.** **No albums.** No comments, reactions, or member-profile interaction surfaces (Phase 6). No advanced search (post-MVP). No timeline view (5B). No moderation controls (8A).

**User stories.** As a member I can scroll my batch's gallery on my phone and it feels instant. As a member I can open a memory and see it large with its story. As a non-member I can reach none of it.

**Database changes.** None expected beyond index tuning against real read paths (architecture §19).

**Security work.** Verify that no read path returns a soft-deleted memory or its media; confirm no cached media response can outlive the viewer's authorization (R2); confirm no superset-then-client-filter pattern exists (architecture §11).

**Backend deliverables.** `features/memories` query layer (keyset pagination); media display URL minting behind `features/media`.

**Frontend deliverables.** Gallery grid and detail page across mobile/tablet/desktop breakpoints (design.md §22–24, §30, §32); skeletons shaped like real content (design.md §18).

**Tests that must actually run.** All standard gates, plus: keyset pagination correctness across page boundaries and with equal `occurred_on` values; **a soft-deleted memory absent from every read path**; cross-batch isolation for a user in two batches; a non-member and a removed member reading the gallery and a known memory id; Playwright gallery→detail E2E; accessibility checks (keyboard-focusable tiles, reduced-motion).

**Acceptance criteria.** PRD §22 criterion 5 met (minus comments/reactions, which land in Phase 6); mobile gallery loads incrementally.

**Definition of done.** The above with gates observed passing.

**Git checkpoint.** `feat: phase 5a gallery and memory detail`.

**memory.md update.** Phase 5A complete; note explicitly that **albums were not built** and why.

**STOP boundary.** STOP after Phase 5A. Do not build albums. Do not build the timeline. Phase 5B begins only on explicit instruction.

### Phase 5B — Timeline & Event Grouping

**Objective.** A distinct chronological browsing mode that makes a batch's years legible, including the long-dormant return case.

**Prerequisites.** Phase 5A complete. Q5 decided if the UI must distinguish a stated from a defaulted `occurred_on`.

**In scope.** Date-anchored vertical timeline over the same `occurred_on` ordering; human, calendar-relatable period markers; event-based grouping/filtering per PRD §9.13; a simple jump-to-period aid for returning alumni (PRD Journey D; design.md §31); sparing reveal motion that degrades to instant appearance under reduced motion.

**Explicitly NOT in scope.** **No albums.** No advanced/semantic search (PRD §15, post-MVP). No "On This Day" resurfacing (post-MVP). No AI grouping of any kind.

**User stories.** As a returning alumna I can move through our years without scrolling from the beginning. As a member I can filter to an event.

**Database changes.** None expected; grouping reads use existing indexes.

**Security work.** Confirm filtering and grouping happen server-side within RLS-constrained queries, never by fetching a superset and filtering client-side (architecture §11).

**Backend/Frontend deliverables.** Timeline query mode; timeline UI per design.md §31.

**Tests that must actually run.** All standard gates, plus: grouping/filter correctness against seeded data; soft-deleted content absent from the timeline; reduced-motion behavior verified; Playwright timeline E2E.

**Acceptance criteria.** Chronological and event-based browsing both work on mobile within PRD §20 expectations.

**Definition of done.** The above with gates observed passing.

**Git checkpoint.** `feat: phase 5b timeline and event grouping`.

**memory.md update.** Phase 5B complete; record the Q5 decision if taken.

**STOP boundary.** STOP after Phase 5B. Do not build comments or reactions. Phase 6 begins only on explicit instruction.

---

## Phase 6 — Social Layer: Comments & Reactions

**Prompt file:** `18_PHASE_6_SOCIAL.md`
**Filename conflict, resolved here: notifications are POSTPONED**, not an MVP feature (architecture §12, §22; database.md §1.2, §20). This phase builds comments and reactions only. The `notifications` module stays an empty reserved boundary and no `notifications` table is created.

**Objective.** Members can comment on and react to a memory, with child-row visibility correctly inheriting the parent memory's visibility.

**Prerequisites.** Phase 5B complete. **Q2 / PRD #3 decided** (the reaction `kind` allowlist).

**In scope.**
- Flat, chronological comments — **no threading** (database.md §3.7, §19).
- One switchable reaction per member per memory, presented as "who felt what" rather than an accumulating like count (database.md §3.8; design.md §32).
- Policy-checked **direct DML** for the two categories this phase introduces: create a comment and author-edit one's own comment body; create, switch, and remove one's own reaction. (security.md §5.4's four direct-DML categories span phases — profile self-service shipped in Phase 1 and own-memory text in Phase 4B.)
- Optimistic UI via `useOptimistic`; no global client state manager for server data (architecture §2; rules.md §2).
- Within-batch member profile view (display name, avatar, bio) reusing `features/profiles`.

**Explicitly NOT in scope.** **No notifications of any kind** — no in-app feed, no push, no digest, no email (architecture §12, §22). No comment threading or replies. No reactions on comments (database.md §3.8). No counter columns (database.md Q6). No moderator removal of others' content (8A). No follower graph, DMs, or public feed — permanently excluded (PRD §4, §14).

**User stories.** As a member I can comment on a memory and edit my own comment. As a member I can react and switch my reaction. As a member I cannot interact with a memory that was removed.

**Database changes.** `comments` and `reactions` (RLS enabled and forced), with the composite same-batch/same-memory FKs, `UNIQUE (memory_id, profile_id)` on reactions, and the thread/count indexes (database.md §3.7–3.8, §10).

**Security work.**
- **Parent-visibility enforced on reads and on the write side** (security.md §5.4.2): a comment or reaction is visible only when its parent memory is visible, and a member may comment/react **only on a memory currently visible to them** — including against a replayed memory id held from before a removal.
- **Identity bound by the database**: `comments.author_id` / `reactions.profile_id` default from `auth.uid()` or are independently required to equal it — a caller-supplied value is never authoritative (security.md §5.4.1, §13).
- Column-level enforcement: `comments.body` and `reactions.kind` writable; `batch_id`, `memory_id`, `author_id`/`profile_id`, timestamps, `deleted_at`, `deleted_by` not.
- Rate limiting on comment/reaction writes (security.md §17).

**Backend deliverables.** `features/comments`, `features/reactions`.

**Frontend deliverables.** Comment composer as a mobile drawer, reaction picker, inline success states (design.md §16–17, §21, §32).

**Tests that must actually run.** All standard gates, plus security.md §5.4.2/§5.6 tests: commenting or reacting on a **soft-deleted or moderator-removed memory** (must fail, including via replayed id); a comment author attempting to change `memory_id` or `batch_id` (relocating it) or `author_id`; a reaction owner attempting to rewrite `profile_id`, `memory_id`, or `batch_id`; a caller inserting with a **forged** `author_id`/`profile_id`; a non-member commenting on a known memory id; reaction uniqueness under concurrent writes; comments of a removed memory absent from every read path.

**Acceptance criteria.** PRD §22 criteria 5–6 met; no child row is readable or writable when its parent is not visible.

**Definition of done.** The above with gates observed passing.

**Git checkpoint.** `feat: phase 6 comments and reactions`.

**memory.md update.** Phase 6 complete; record the Q2 decision; note explicitly that **notifications were not built** and why.

**STOP boundary.** STOP after Phase 6. Do not build time capsules or yearbook. Do not build notifications. Phase 8 is next — see Phase 7.

---

## Phase 7 — (No MVP Scope)

**Prompt file:** `19_PHASE_7_CAPSULE_YEARBOOK.md`
**Filename conflict, resolved here.** Time capsules and yearbook are **both post-MVP**: architecture §22 postpones them, §16 reserves their module boundaries, `database.md` §22–23 designs them explicitly **"Post-MVP. Not created,"** and PRD §15 lists them as post-MVP. No source document schedules either into the MVP.

**Therefore Phase 7 contains no MVP implementation work.** MVP proceeds directly from Phase 6 to Phase 8.

- Nothing is built: no `time_capsules`, `time_capsule_entries`, or `yearbook_entries` table; no capsule or yearbook route, module code, or UI.
- The reserved `time-capsules` and `yearbook` directory boundaries remain empty (architecture §16).
- Visual direction already exists for both (design.md §33–34) as **direction only**, and must not be read as a build instruction.
- Two constraints must survive into any future implementation: unlock is a **read-time visibility predicate**, never a scheduled flag flip (ADR-11; database.md §22), and **every row storing a sealed payload carries its own lock** (database.md §22). `Q8` (whether a sealed capsule's existence is visible) must be decided before the feature ships.
- If prompt 19 is run, the correct outcome is to **decline the MVP build**, cite this section, and confirm the boundary is intact.

**STOP boundary.** There is nothing to stop after. Proceed to Phase 8 only on explicit instruction.

---

## Phase 8 — Moderation, Privacy & Lifecycle

**Prompt file:** `20_PHASE_8_MODERATION_PRIVACY_EXPORT.md`
Split into two sub-phases: moderation is independent of the irreversible lifecycle work, which carries unresolved blockers.

### Phase 8A — Reporting, Moderation & Audit Visibility

**Objective.** Members can report content; moderators and above can review a batch-scoped queue, remove content, and see the audit trail — all without exposing reporter identity.

**Prerequisites.** Phase 6 complete. **PRD #5 decided** (retention policy for removed/reported content). B4 design work begun (its release gate is Phase 9).

**In scope.**
- Report creation RPC that **resolves the target server-side** and derives the immutable `target_kind`/`target_id` snapshot from the resolved row, setting `batch_id` from the **target's** batch, never from caller input (security.md §13; database.md §3.9).
- Batch-scoped moderation queue readable by **mod+ only**; reporter identity never disclosed to the reported party (security.md §18).
- Moderator content removal as **soft delete**, audited, hidden immediately from every read path, with no tombstone that re-exposes what it hides (security.md §19, §23).
- Content restoration within the retention window as a privileged, audited operation.
- Audit-log view for **admin+ of that batch only** (security.md §20).
- Self-reporting treated as a takedown request (PRD §16).
- Retention reaping sweep for soft-deleted content, **object-first**, per the PRD #5 windows (database.md §24; architecture §13).

**Explicitly NOT in scope.** No batch deletion or account deletion (8B). **No export** (8B, gated on Q9). No platform-level/operator moderation tooling — that is blocker B4, resolved as a Phase 9 release gate. No cross-batch or public moderation surface (security.md §19).

**User stories.** As a member I can report a memory, comment, or member, and my identity stays private. As a moderator I can review the queue and remove content. As an admin I can read our audit log. As a reported member I cannot see the report or who filed it.

**Database changes.** `reports` (RLS enabled and forced), with the immutable snapshot columns, the composite same-batch live-reference FKs with column-specific `ON DELETE SET NULL`, the moderation-queue index, and the **snapshot-based duplicate-suppression** unique index (database.md §3.9, §10).

**Security work.** `REVOKE UPDATE (target_kind, target_id)` so the snapshot cannot drift; reports readable by mod+ only; report creation RPC-only; a report **never blocks** deletion of its target; every moderation action audited with `actor_role` frozen.

**Backend deliverables.** `features/moderation`; retention sweep cron handler.

**Frontend deliverables.** Report affordance kept visually quiet for ordinary members; moderation queue in the product's card/list language, not a data table (design.md §24, §32).

**Tests that must actually run.** All standard gates, plus: a reporter attempting to read the queue; a **reported member attempting to see the report or its reporter**; a non-mod+ attempting removal or restoration; an attempt to update `target_kind`/`target_id`; duplicate open reports from one reporter about one target suppressed; deleting a reported memory/comment/membership **not blocked** by the report, with the snapshot surviving; removed content absent from every member read path and its **bytes not fetchable by direct Storage path** (security.md §7.1); audit rows not updatable or deletable.

**Acceptance criteria.** PRD §22 criterion 8 met; reporter anonymity holds; moderation is batch-internal only.

**Definition of done.** The above with gates observed passing.

**Git checkpoint.** `feat: phase 8a reporting moderation and audit`.

**memory.md update.** Phase 8A complete; record the PRD #5 decision; note B4 still open as a release gate.

**STOP boundary.** STOP after Phase 8A. Do not build batch deletion, account deletion, or export. Phase 8B begins only on explicit instruction, and only with **B3/Q3, PRD #6, Q7 and R10/Q9 decided**.

### Phase 8B — Batch & Account Lifecycle (Gated)

**Objective.** Owners can delete a batch safely and users can delete their account — each only once its unresolved prerequisite is decided.

**Prerequisites (hard).** **B3 / Q3 decided** — the account-deletion flow must not ship without it. **PRD #6 decided** (batch-deletion mechanics). **Q7 decided** (audit rows after batch hard-delete). **R10 / Q9 decided** before *any* export surface is built. R3 (re-authentication before destructive actions) decided.

**In scope.**
- Batch soft delete with a grace period, owner-only, high-friction, audited before the deletion completes (security.md §24; PRD §18).
- **Object-first hard deletion**: enumerate `media_assets` while `storage_path` still exists, delete or confirm-absent every Storage object in bounded pages, and **only then** hard-delete the batch row and let the subtree cascade — idempotent and retryable (security.md §24; database.md §24). Never cascade-first.
- Batch restoration within the grace window as a privileged, audited operation.
- Account deletion implemented **exactly per the B3 decision**, retaining contributions with attribution nulled and cascading memberships/reactions (security.md §22; database.md §12). Auth-user deletion is one of the few legitimate service-role call sites (security.md §12).
- Batch privacy/settings controls completed.
- **Export: only what the decided Q9 scope permits.** The narrow commitment already in PRD §18 is that a member can reasonably access/download their own uploaded content; any surface built here must satisfy every invariant in security.md §25 (never beyond the caller's authorized batch scope, rate-limited, audit-logged, requester-scoped short-lived delivery, with `token_hash`, audit/moderation records, and other users' `auth.users` data excluded). **If Q9 is not decided, no export ships in MVP.**

**Explicitly NOT in scope.** **This document does not decide export scope.** No bulk/whole-batch export unless Q9 explicitly authorizes it. No public showcase (post-MVP, ADR-12). No archival-format tooling (PRD §15).

**User stories.** As an owner I can delete our batch with real friction and a recovery window. As a user I can delete my account and understand honestly what is and is not removed. As a member I can obtain my own uploaded content, if Q9 permits.

**Database changes.** No new tables; soft-delete/reaping behavior and the retention windows from PRD #5–6.

**Security work.** Re-authentication before batch deletion and ownership transfer (R3); confirmation naming the batch; object-first ordering proven by test; honest user-facing wording for what account deletion does not remove (R4, whose legal review is a Phase 9 gate).

**Backend deliverables.** Batch/account lifecycle RPCs and the bounded, idempotent deletion worker.

**Frontend deliverables.** Highest-tier destructive confirmations — centered modal, typed confirmation naming the batch (design.md §13–14, §16).

**Tests that must actually run.** All standard gates, plus: **object-first ordering verified** (a failure between object deletion and row deletion leaves a recoverable state, never stranded bytes); deletion idempotency across a retried run; a non-owner attempting batch deletion; an admin attempting to delete the batch or remove the owner; soft-deleted batch content invisible to every member during the grace period, **including by direct Storage path**; account deletion leaving contributions intact with attribution nulled; the B3 owner-deletion path behaving exactly as decided; any export surface refusing to exceed the caller's authorized scope.

**Acceptance criteria.** No path strands private bytes; no batch becomes ownerless in a way the B3 decision does not sanction; export (if any) satisfies security.md §25.

**Definition of done.** The above with gates observed passing and every hard prerequisite recorded as decided.

**Git checkpoint.** `feat: phase 8b batch and account lifecycle`.

**memory.md update.** Phase 8B complete; record the B3, PRD #6, Q7, Q9 and R3 decisions verbatim.

**STOP boundary.** STOP after Phase 8B. Phase 9 begins only on explicit instruction.

---

## Phase 9 — Quality, Security Review & Production Readiness

**Prompt file:** `21_PHASE_9_QUALITY_PRODUCTION.md`

**Objective.** Close every pre-launch blocker, prove the privacy guarantees adversarially end to end, and make the product genuinely releasable.

**Prerequisites.** Phases 0–6 and 8 complete (Phase 7 has no MVP scope).

**In scope — release gates that must be closed here.**

| Gate | Requirement |
|---|---|
| **B1 — EXIF / GPS** | The chosen §27 option is implemented and verified, or release is blocked. Shipping as-originally-specified would silently broadcast members' home coordinates |
| **B4 — Platform moderation** | A minimal, audited operator capability plus a written policy governing its use exists before real users arrive |
| **R9 — Storage response headers** | Actual Supabase Storage behavior verified per allowed type; if required headers cannot be guaranteed, the media-delivery design compensates (authorizing route, or an inert-only allowlist) |
| **R4 — Erasure wording/legal** | Honest user-facing wording plus legal review of account deletion against erasure rights |
| **R6 — HEIC** | A product answer exists so iPhone users do not hit a wall |
| Backup/restore | Managed backups configured deliberately; **restore rehearsed**; Storage durability treated as distinct from database durability; independent off-vendor export scoped (architecture §20; security.md §26) |

**Also in scope.** Full Playwright E2E across the core loop; accessibility audit of every PRD §19 flow (keyboard, screen reader, contrast, reduced motion); performance verification against PRD §20 on mobile-class conditions; **the complete adversarial security suite re-run as a whole** (security.md §5.6, §7.1, plus per-RPC tests from §5.2.2); Sentry with PII scrubbing on and request bodies off, plus structured logging verified to contain identifiers and never content, tokens, or URLs (security.md §21); rate limits verified across §17's surfaces; security-header configuration per security.md §29; production deployment readiness.

**Explicitly NOT in scope.** No new features. No post-MVP work. No AI. No album/notification/capsule/yearbook/showcase implementation.

**User stories.** As a batch, our private archive is genuinely private, fast on a phone, usable with assistive technology, and recoverable.

**Database changes.** Index/query tuning only, driven by measured read paths (architecture §19).

**Security work.** The full §5.6 negative matrix executed **through the REST API directly, not through the app**: non-member, pending requester, rejected requester, removed member, member of a different batch, cross-batch isolation, every column-level forgery case, and every RPC-level privilege case. Confirm no client artifact contains the service-role key.

**Tests that must actually run.** Every gate in the Quality Gates table, all of it observed: `pnpm lint`, typecheck, Vitest, Playwright, `next build`, `pnpm audit`, the adversarial RLS/RPC/Storage suite, accessibility and reduced-motion checks, performance checks, and the restore drill. **A release decision may not be made on the assumption that these pass.**

**Acceptance criteria.** All ten PRD §22 acceptance criteria met — criterion 9 (a non-member verifiably cannot reach a private batch's gallery, detail, roster, comments, or reactions **at the database level**) and criterion 10 (no excluded feature present) proven by test, not assertion. Every blocker above closed or release explicitly withheld.

**Definition of done.** Gates observed passing, blockers closed, backups rehearsed, and any remaining accepted risk (R1, R2, R5, R7, R8) written down as a knowing decision rather than an oversight.

**Git checkpoint.** `chore: phase 9 production readiness`.

**memory.md update.** Phase 9 complete; record each blocker's resolution, remaining accepted risks, and release status.

**STOP boundary.** STOP after Phase 9. Post-MVP work begins only as a new, explicitly scoped decision.

---

## Post-MVP Boundaries (Not Designed or Implemented Here)

Each remains a reserved boundary so it can arrive later without a restructure. None is scheduled, and none may be built during an MVP phase.

| Capability | Status and source | Boundary preserved |
|---|---|---|
| **Albums / curated collections** | Post-MVP (architecture §16, §22; database.md §1.2; PRD §15) | Empty `features/albums`; `albums` / `album_memories` designed but **not created** |
| **Notifications** (in-app, push, digest, email) | Postponed (architecture §12, §22; database.md §20) | Empty `features/notifications`; `notifications` designed but **not created**; other modules would emit domain events to it, never to a provider directly |
| **Time capsules** | Post-MVP (architecture §22, ADR-11; database.md §22; PRD §15) | Empty `features/time-capsules`; unlock must remain a read-time predicate; every sealed-payload row carries its own lock; Q8 open |
| **Yearbook** | Post-MVP (architecture §22; database.md §23; PRD §15) | Empty `features/yearbook`; peer notes stay a separate table from self-authored entries |
| **Public showcase** | Post-MVP, **explicit opt-in only** (ADR-12; project-context §11) | Publication is an explicit copy/mark into a separate future bucket — **never** a permission relaxation on private storage |
| **Advanced search / discovery** | Post-MVP (PRD §15); batches are **not discoverable** (security.md §10) | No directory, no search index, no endpoint confirming a batch exists |
| **Richer media processing / transcoding** | Post-MVP (architecture §10, §22, ADR-08a) | Contained behind the `media` module; authoritative `ffprobe`-class inspection would slot in post-finalize |
| **AI features** | Deferred (`00_READ_ME_FIRST.md`: do not build AI features until the normal product works well for real users) | Not in any MVP phase |
| **Permanently excluded** | DMs, follower graph, reels feed, marketplace, dating, crypto/blockchain, live streaming, **facial recognition** (PRD §4, §14; architecture §22; database.md §1.3) | Not deferred — excluded. Person-tagging, if ever built, is manual only |

---

## Prompt-Pack Mapping and Conflicts

Later prompts are sequencing hints, not scope authority. **Where a prompt's name conflicts with documented scope, the implementation prompt must follow `phases.md` and the source documents.**

| Prompt file | Phase | Conflict / note |
|---|---|---|
| `12_PHASE_0_FOUNDATION.md` | 0 | Aligned. Adds the B2 verification gate |
| `13_PHASE_1_AUTH_PROFILE.md` | 1 | Aligned |
| `14_PHASE_2_BATCHES_MEMBERSHIP.md` | 2 (+3B) | Membership *decisions* moved to Phase 3B, where a second member exists |
| `15_PHASE_3_INVITES_JOIN.md` | 3A / 3B | Aligned; split for session size. **No email provider** — invites are user-shared links (ADR-08b) |
| `16_PHASE_4_MEMORIES_MEDIA.md` | 4A / 4B | Aligned; split so the photo pipeline is correct before video |
| `17_PHASE_5_GALLERY_ALBUMS_TIMELINE.md` | 5A / 5B | **CONFLICT: "ALBUMS" in the filename does not schedule albums.** Albums are post-MVP; build gallery, timeline, and detail only |
| `18_PHASE_6_SOCIAL.md` | 6 | **CONFLICT: notifications are postponed**, not part of the MVP social layer. Comments and reactions only |
| `19_PHASE_7_CAPSULE_YEARBOOK.md` | 7 | **CONFLICT: both capsules and yearbook are post-MVP.** This phase has **no MVP scope**; decline the build and cite Phase 7 |
| `20_PHASE_8_MODERATION_PRIVACY_EXPORT.md` | 8A / 8B | **Partial conflict: "EXPORT" is gated.** Export scope (Q9/R10) must be decided first; full export tooling is post-MVP (PRD §15) |
| `21_PHASE_9_QUALITY_PRODUCTION.md` | 9 | Aligned. Carries the B1, B4, R9, R4, R6 release gates |

---

## Phase List

- **Phase 0** — Foundation
- **Phase 1** — Authentication & Profile
- **Phase 2** — Batch Spaces
- **Phase 3A** — Invitations & Join
- **Phase 3B** — Membership Decisions & Roles
- **Phase 4A** — Photo Upload Pipeline
- **Phase 4B** — Video Constraints, Edit/Delete & Media Reliability
- **Phase 5A** — Gallery & Memory Detail
- **Phase 5B** — Timeline & Event Grouping
- **Phase 6** — Social Layer: Comments & Reactions
- **Phase 7** — (No MVP scope — time capsules and yearbook are post-MVP)
- **Phase 8A** — Reporting, Moderation & Audit Visibility
- **Phase 8B** — Batch & Account Lifecycle (Gated)
- **Phase 9** — Quality, Security Review & Production Readiness

---

## First Demoable Experience

**Phase 4A is the first demoable experience.** It is the first point at which the product's actual promise exists end to end: a real person signs up, creates a private batch, invites a classmate, that classmate joins, and a photo with a caption and a date lands in the batch and is visible to both of them. Everything before it is real but not yet a story — Phase 2 has a batch with nothing in it, and Phase 3 has members with nothing to look at.

Two honest qualifications. Phase 4A's viewing surface is a deliberately unpolished verification list, so the demo proves the *loop*, not the *feeling*. **Phase 5A is the first demo worth showing to an actual batch**, because the gallery is the core surface and the first place the design language (photography-first, blur-placeholder-instant, mobile-first) is visible. If a single milestone must carry a stakeholder demo, choose **Phase 5A**; if the question is "when does BatchVault first genuinely work," the answer is **Phase 4A**.

---

STOP — Prompt 08 complete. No application code, migrations, or SQL were created, no packages were installed, no previous documentation file was modified, and nothing was committed. `docs/testing.md` (Prompt 09) is **not** started. Awaiting the next instruction.
