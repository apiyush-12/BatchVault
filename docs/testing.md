# BatchVault — Testing Strategy

Status: Draft — MVP testing strategy
Sources of truth: `/docs/project-context.md`, `/docs/PRD.md`, `/docs/architecture.md`, `/docs/database.md`, `/docs/security.md`, `/docs/rules.md`, `/docs/design.md`, `/docs/phases.md`
Prepared per: `/prompts/09_TESTING.md`

**What this document is.** The definitive testing strategy for BatchVault. It defines what gets tested, at what level, with what tooling, and to what standard of proof — before implementation begins. It writes no tests, no application code, no SQL, and it installs nothing. It invents no product, architecture, database, security, design, or phase decision. Where a source document leaves something unresolved, this document preserves it as unresolved and describes how testing adapts once the decision is made — it does not decide it here.

**Precedence.** Where anything here conflicts with `project-context.md`, `PRD.md`, `architecture.md`, `database.md`, `security.md`, `rules.md`, `design.md`, or `phases.md`, those documents win and this document is wrong.

**Source-of-truth rule, restated for this document.** `09_TESTING.md`'s own required section list (below, §14) is honored in full, but where it names something the source documents place post-MVP — most notably its item 13, "time-capsule tests" — the resolution follows `phases.md`'s own precedent for its Phase 7: the section exists, states the conflict, and preserves the boundary as a **future testing consideration**, not an MVP gate (see §3.12).

**Locked test tooling** (rules.md §1–2, `phases.md` throughout): **Vitest** for unit/integration tests, **Playwright** for browser/E2E tests, **pnpm** for every script and command, **strict TypeScript** everywhere including test code. No Jest, no Cypress, no second test framework introduced for any reason.

---

## 1. Testing Philosophy

BatchVault's core security property — private batch data is invisible to anyone not an authorized member — is enforced at the database and Storage layer, not the application (security.md, "The rule everything else serves"; architecture ADR-03). Testing philosophy follows directly from that:

1. **A test that only calls the application is not a security test.** Because a browser can call PostgREST and Supabase Storage directly with the public anon key (security.md §1.3), the adversarial suite for every table, policy, RPC, and Storage path must be exercised **through the REST/Storage API directly**, not only through the app's Server Actions (security.md §5.6, §7.1). An application-layer test that "the UI hides the button" proves nothing about the boundary.
2. **Negative-first, not coverage-first.** Policies fail *silently* when too permissive — nothing errors, nothing logs, the data simply comes back (security.md §5.6). A high line-coverage number is not evidence of a closed boundary; an explicit, named adversary attempting a specific forbidden action and being refused is. Every security-sensitive surface is tested from the adversary's seat first.
3. **Never claim a gate passed unless it was actually run and its output observed, in this session** (CLAUDE.md rule 7; rules.md §6 rule 6, §8 rule 7; `phases.md`'s Standing Rule 7). This document defines gates; it does not run them, and running them is never assumed from the fact that they are configured.
4. **Unresolved stays unresolved.** Nine database-design questions (Q1–Q10, minus Q6/Q10 which are non-blocking), four security blockers (B1–B4), and ten accepted risks (R1–R10) are open in the source documents. Testing scope for each is written as a **conditional plan** — what to test once the decision is made — never as a silent resolution.
5. **Fixtures are deterministic and isolated.** No test may depend on another test's leftover state, execution order, or a shared mutable persona (§4).
6. **Tooling is fixed.** Vitest, Playwright, pnpm, strict TypeScript — no exceptions, no second framework "just for this one case."

### Configured, Executed, Passing, Skipped — four different claims

These words are not interchangeable, and this document is written to keep them distinct everywhere below:

| Term | Means | Does **not** mean |
|---|---|---|
| **Configured** | A test/gate exists in the codebase and CI is wired to invoke it | That it ran, or that anyone has seen its result |
| **Executed** | The command actually ran in a real session (local or CI) and produced observable output | That the output was good |
| **Passing** | It was executed, and its observed output was success | That it is configured correctly for what it claims to test — a passing test with no adversarial case proves nothing (Philosophy point 2) |
| **Skipped / Not applicable** | Deliberately not run for a stated reason (e.g., a phase with no UI has no Playwright/accessibility gate) | An unstated omission. "Not applicable" is always named, never implied |

**No phase, and no gate, may be reported as passing on the strength of being configured.** A phase's Definition of Done (`phases.md`, every phase) requires execution and observed output.

---

## 2. The Test Pyramid

Eight levels, each with a distinct job. A failure that could have been caught cheaply at a lower level should not be the only thing standing at a higher one.

### 2.1 Pure Unit Tests

- **Belongs here:** functions with no I/O and no framework context — Zod schemas (valid/invalid shape acceptance, allowlist-not-denylist behavior, length/range caps mirroring `database.md` CHECK constraints per rules.md §1.6); the `lib/authz` role-comparison helper that mirrors the SQL role hierarchy (architecture §17; database.md §15) — **as a pure function only**, proving `role >= 'moderator'`-style comparisons are correct in isolation; date/formatting/display helpers (e.g., rendering a "former member" attribution, human date labels for the timeline per design.md §31); reduced-motion branching logic in the shared motion wrappers (design.md §28–29) as a pure function of a boolean input.
- **Does not belong here:** anything that touches Postgres, Supabase Auth, Storage, the network, or the file system. A "unit test" that mocks a Supabase client to assert an authorization outcome is not proving the authorization boundary — see §2.2's caveat.
- **Tool:** Vitest.
- **Environment:** Node only. No network, no database, no browser.
- **Determinism:** Should be perfectly deterministic — same input, same output, every run, every machine, no flakiness tolerated.

### 2.2 Application / Service Integration Tests

- **Belongs here:** a Server Action's or query function's **request-shaping and validation branching** — does it reject a malformed payload before touching the database (rules.md §1.2's fixed order: authenticate → validate → authorize → execute → revalidate)? does it return the correct discriminated `{ ok: false, error }` shape (architecture §18.2)? does it call the expected query/RPC with the expected arguments? These may run against a lightweight or mocked Supabase client where the point is testing the *application's* logic, not the database's.
- **Does not belong here — the caveat that matters:** **a mocked or RLS-disabled test can never be the proof that an authorization boundary holds.** If a test at this level asserts "a non-member is refused," and it does so by mocking the Supabase client to return an error, it has proven the application handles that error correctly — it has proven nothing about whether the database would actually produce that error. That proof is §2.3's job, and only §2.3's job.
- **Tool:** Vitest.
- **Environment:** Node; may use a real local Supabase instance for some cases (see below) or a mock for pure request-shaping cases. Either is acceptable **only because §2.3 exists as the real proof**.
- **Determinism:** Deterministic; mocked dependencies mean no network flakiness.

### 2.3 Database / RLS / RPC Integration Tests

- **Belongs here:** every RLS policy, every privileged RPC, every column-level enforcement rule — exercised by **impersonating each persona's real JWT and calling PostgREST/the database function directly**, not through the app (security.md §1.3, §5.6). This is the level that carries almost all of §3 below: the full adversarial matrix for `profiles`, `batches`, `batch_members`, `batch_invites`, `memories`, `media_assets`, `comments`, `reactions`, `reports`, `audit_logs`, and every RPC in security.md §5.2.
- **Does not belong here:** anything about rendering, browser behavior, or the UI. A test proving `reports` is unreadable by a non-mod+ role is a database test even though "reading the report queue" is also a UI feature — the UI-level version of that check (a hidden button) is not this test and does not substitute for it.
- **Tool:** Vitest, calling the database via a real Postgres/PostgREST client (or an equivalent direct-SQL harness for cases PostgREST does not expose), impersonating personas by minting real JWTs for each (§4).
- **Environment:** A disposable/ephemeral local Supabase stack (Supabase CLI) or an isolated test project, with **every migration and every RLS policy actually applied** — this level is worthless against a database with RLS disabled or a schema that has drifted from `database.md`. Never run against production; never run against a shared preview project other tests could be mutating concurrently.
- **Determinism:** Deterministic given fixtures reset per test (transactional rollback where the harness supports it, or full reseed otherwise per §4) — no dependency on prior test ordering or leftover rows.

### 2.4 Supabase Storage Authorization Tests

- **Belongs here:** every Storage-path authorization case in security.md §6–7 — called **directly against the Storage REST API by path**, with different bearer tokens, exactly as security.md §7.1's own list of required negative tests specifies. This is a distinct level from §2.3 because Storage RLS is a second, separate policy surface that must independently reflect the *database's* visibility state (security.md §7.1) — testing the table alone proves nothing about whether the object is still fetchable by path.
- **Does not belong here:** signed-URL delivery convenience logic (the *application's* URL-minting code is a §2.2 concern); this level tests the underlying Storage authorization decision itself, which exists whether or not the app ever mints a URL.
- **Tool:** Vitest (or the same harness as §2.3), issuing raw HTTP calls to the Storage endpoint with persona bearer tokens and known object paths.
- **Environment:** The same disposable local/ephemeral Supabase stack as §2.3, with real buckets and real Storage policies, pre-seeded with objects at known paths in known states (`pending`, `ready`, `rejected`, soft-deleted parent, soft-deleted batch).
- **Determinism:** Deterministic given fixed, reseeded object paths and states per test run.

### 2.5 Browser End-to-End Tests

- **Belongs here:** real user flows through the actual running app — sign up, create a batch, invite, join, upload, browse, comment, react, report, moderate (§7's full list) — proving the *integrated* system behaves as intended, including things no lower level can see (a redirect actually happens, a toast actually appears, a form actually submits).
- **Does not belong here:** re-litigating the full adversarial matrix. E2E is not where "can a non-member read Batch B" gets proven — that is §2.3/§2.4's job, done once, thoroughly, at the API layer. E2E includes only the adversarial cases that are meaningfully different *as a browser flow* (e.g., an invalid invite link showing one generic screen, §3.4).
- **Tool:** Playwright.
- **Environment:** A running build of the app (dev or preview) pointed at the same disposable/ephemeral Supabase stack as §2.3–2.4, so E2E and API-level tests share one source of truth for seed data.
- **Determinism:** The least deterministic level by nature (network, browser rendering, timing). Mitigations: no arbitrary `sleep`s — wait on explicit signals (network-idle, a specific element's state); every test seeds its own uniquely-named data (unique emails/ids per run) rather than relying on shared global fixtures; a pinned browser version in CI; a bounded, explicit retry policy for genuinely flaky infrastructure failures that never masks a real assertion failure.

### 2.6 Accessibility / Reduced-Motion Verification

- **Belongs here:** automated accessibility scanning of every screen that ships UI (an axe-style automated checker integrated into Playwright is the natural fit given the locked tooling — the specific package is an implementation choice, not fixed by any source document); keyboard-only traversal of each PRD §19 core flow; verification that every icon-only control has an accessible name (design.md §10, §25–26); verification that focus is visible and distinct from hover (design.md §27); and — specifically — that every animated surface renders its reduced-motion equivalent when `prefers-reduced-motion` is emulated in the browser context (design.md §29; PRD §19; architecture §2). This is a **hard requirement with zero exceptions**, not a nice-to-have, per rules.md §1.5 and design.md §29.
- **Does not belong here:** a full manual audit by an accessibility specialist — valuable, but outside this document's automatable test scope. Automated scanning catches a meaningful subset (missing labels, contrast failures, focus-order issues) and is treated as a floor, not a ceiling.
- **Tool:** Playwright, plus an automated accessibility-scanning integration.
- **Environment:** Same as §2.5.
- **Determinism:** Automated scans are deterministic given a stable DOM state; manual keyboard-traversal checks are procedural (a repeatable script) rather than automatically re-runnable, and are called out as such rather than falsely counted as CI-automated.

### 2.7 Production-Build / Static Quality Gates

- **Belongs here:** `pnpm lint`, the strict TypeScript typecheck, `next build`, `pnpm audit`. No test logic of its own — these gates prove the codebase is internally consistent and ships, independent of runtime behavior.
- **Does not belong here:** anything requiring a live service.
- **Tool:** pnpm scripts wrapping ESLint, `tsc`, `next build`, and `pnpm audit` (rules.md §7).
- **Environment:** The repository and its toolchain only — no live Supabase project, no browser.
- **Determinism:** Fully deterministic given a fixed lockfile (`pnpm-lock.yaml`, rules.md §2).

### 2.8 Release / Security Regression Testing

- **Belongs here:** the **complete** §2.3/§2.4 adversarial suite re-run as a whole immediately before a release, plus the Phase 9 release-gate blockers (§3.11, §6, `phases.md` Phase 9): B1, B4, R9, R4, R6, and a rehearsed backup/restore drill (architecture §20; security.md §26). This is where "does every guarantee still hold, together, right now" gets asked one more time, after every phase has independently claimed it holds.
- **B4 — no test exists yet, because no capability exists yet.** Security.md §32 B4 (no platform-level moderation path for a hostile owner) names a **missing capability**, not a testable behavior of anything currently designed. This level's job is to confirm, before release, that a minimal, audited operator capability and a written policy governing its use have been added (`phases.md` Phase 9) — and, once they exist, to test them with the same adversarial rigor as any other privileged surface (§3.3's checklist applies). Until that capability is designed, there is nothing here to test, and that absence is itself the tracked blocker.
- **R7 and R8, named for completeness, deliberately without a dedicated test.** R7 (no per-batch storage quotas) is the absence of a feature — there is no behavior to assert beyond the per-file caps already covered in §3.8. R8 (backup access sits outside every control in this document) is an organizational control, not a testable application behavior; it is addressed by the backup/restore drill above and by named, reviewed operator access, not by a Vitest/Playwright test. Both are recorded here so their absence from the test suite is a stated decision, not a silent gap.
- **Does not belong here:** first-time discovery of a new adversarial case — every case here should already be a named test from an earlier phase; this level re-runs them, it does not invent them.
- **Tool:** Vitest/Playwright, same harnesses as §2.3–2.5, run against an environment configured as close to production as a pre-release check reasonably can be, with isolated (non-real) data.
- **Determinism:** As deterministic as §2.3–2.5 individually; the risk this level manages is drift between phases, not flakiness within a single run.

---

## 3. Security Testing (Non-Negotiable)

Every adversarial requirement below is carried forward from `security.md`, not invented here. Unless stated otherwise, these are **§2.3/§2.4-level tests**: called directly against PostgREST/Storage, impersonating the persona named, never routed only through the app.

### 3.1 Auth / Profile

- Unauthenticated read of `profiles` — refused.
- **One authenticated user attempts to `INSERT` a profile row whose `id` is another auth user's id** — must fail, or the value must be overridden by `auth.uid()`; a profile for an identity the caller does not own must never come into existence (security.md §5.4.1, §5.6).
- A profile owner attempts to `UPDATE` `id`, `deleted_at`, `onboarding_completed_at`, or another system field on their own row — rejected at the database (security.md §5.4.1).
- **Onboarding completion — the matched pair** (security.md §5.4.3, §5.6): the **legitimate** controlled path marks the caller's *own* onboarding complete and the gate then lets them proceed; **and** the field remains unwritable by ordinary DML, including (a) a direct `UPDATE` of `onboarding_completed_at` on one's own row, (b) an attempt to set it on **another user's** row, and (c) an attempt to supply a caller-chosen timestamp instead of the server-generated value. A suite that tests only the refusal, and never the legitimate path, would let a correct-looking implementation ship an unusable onboarding gate — which is exactly the gap the Prompt 11 audit found.
- A profile owner attempts to set `avatar_path` to **another profile's** avatar object, and separately to an arbitrary or batch-media path — both rejected (security.md §5.4.1, §6.1).
- **Avatar visibility**: a user shares no active batch with the profile owner — avatar read refused (security.md §6.1). A user shares an active batch — avatar read succeeds. **Loss-of-access test**: after the *last* shared active batch ends (removal, departure, or the batch itself is soft-deleted), avatar read is refused going forward — subject to the same already-minted-signed-URL caveat as all Storage content (§3.7).
- No enumeration path: knowing a profile id is not sufficient to fetch its avatar or infer its existence (security.md §6.1).

### 3.2 Batch / Membership

- A non-member reads `batches`, `batch_members`, or `audit_logs` for a batch they are not in — refused, and refused **indistinguishably from that batch not existing** (security.md §3, "indistinguishable denial"; PRD §22 criterion 9).
- A **pending** requester, a **rejected** requester, and a **removed** former member each attempt every read (gallery-adjacent roster, batch settings, audit log) — all refused; a pending requester's own read of `batch_members` returns only their own row (security.md §5.4, §10).
- **Cross-batch, with known UUIDs**: a member of Batch A supplies Batch B's known ids to every query and RPC they can reach — refused throughout (§4's two-batch fixture exists specifically for this).
- **The single most important negative test in the suite** (security.md §5.6, §3.9's own emphasis, carried into `phases.md` Phase 2): **a user attempts a direct PostgREST `INSERT` into `batch_members` supplying a batch id** — must fail at the privilege level, not merely at a policy. Success here would make every invite control decorative.
- **Batch creation cannot leave an ownerless batch** — attempt to call/replicate the create-batch RPC in a way that inserts the batch without its owner membership (e.g., a partial-failure simulation) — the transaction must leave neither row, never one without the other (security.md §5.2.1).
- **Audit rows cannot be modified or deleted** by any client role — attempted `UPDATE`/`DELETE` on `audit_logs` refused at the grant level (security.md §20, database.md §3.10).
- The membership-helper function is probed with intent to learn about a batch the caller is not in (§3.3) — reveals nothing (security.md §5.3, §5.6).

### 3.3 Privileged RPCs

**Every** RPC in security.md §5.2's list — reproduced from `phases.md`'s inventory, by the phase that introduces it — gets this full checklist, not a subset:

| RPC | Introduced |
|---|---|
| Batch creation + initial owner membership | Phase 2 |
| Invite creation | Phase 3A |
| Invite redemption / membership creation | Phase 3A |
| Membership approval / rejection / removal | Phase 3B |
| Role changes | Phase 3B |
| Ownership transfer | Phase 3B |
| Media preallocation | Phase 4A |
| Media finalize | Phase 4A |
| Report creation | Phase 8A |
| Audit-log insertion | Written in-transaction by each of the above; no standalone client entry point |
| Batch deletion / restoration | Phase 8B |

**Before the per-operation checklist: direct DML against every RPC-only surface is refused at the privilege/grant level, not merely by a row policy.** Because the client role holds no `INSERT`/`UPDATE`/`DELETE` privilege on these tables at all (security.md §5.2), a test that attempts a direct write — bypassing the RPC entirely — must fail on the missing grant itself, for **every** RPC-only table: `batches`, `batch_members`, `batch_invites`, `media_assets` (the preallocation/finalize-owned columns), `reports`, `audit_logs`, and the batch-deletion/restoration path. This is a distinct, named requirement in security.md §5.6 ("direct DML is attempted against each RPC-only operation in §5.2 and is refused at the privilege level, not merely by a policy") and is tested once per table, independent of the ten adversarial cases below, which test the RPCs themselves.

**The checklist, applied to each RPC:**

1. **Unauthenticated caller** — refused.
2. **Non-member** of the target batch — refused.
3. **Member of another batch** — refused, including when supplying the correct batch id for a batch they are not in.
4. **Insufficient role** for the operation (e.g., a member calling an admin-only settings RPC) — refused.
5. **Forged actor identity or role** — the caller's payload asserts a role or identity different from what `auth.uid()` and `batch_members` actually say; the RPC must resolve the real value and refuse (security.md §11's "a role-change caller forges their actor role" test is the canonical instance, generalized to every RPC).
6. **Acting on a peer or superior where forbidden** — a moderator targeting an admin, an admin targeting another admin or the owner, an actor targeting themselves where self-action is forbidden (security.md §4, §11).
7. **Illegal state transition** — e.g., approving an already-removed membership, redeeming an already-revoked invite, transferring ownership to a non-member.
8. **Well-formed but unauthorized target** — a syntactically valid id that resolves to a real row the caller is simply not entitled to act on.
9. **Operation atomicity / rollback on failure** — a simulated mid-operation failure (e.g., the second of two writes in ownership transfer) leaves **neither** side effect, never a partial state (security.md §5.2.1's ownerless-batch concern generalizes to every multi-row RPC).
10. **Minimum `EXECUTE` exposure** — confirm the RPC's `EXECUTE` grant is limited to the roles that must call it, not broadly granted (security.md §5.2.2).

**B2 — verified before anything above is trusted.** Per security.md §32 B2 and `phases.md`'s Phase 0 hard gate: the real interaction between `SECURITY DEFINER`, function ownership, and `FORCE ROW LEVEL SECURITY` must be proven **in the target Supabase environment** — not assumed from documentation — before any test above is treated as validating a real boundary, and before the membership-helper function (§3.2) is trusted not to recurse or misbehave. This verification, and its accompanying negative test (the helper cannot become an oracle), is itself a test deliverable of Phase 0, and every later phase's RPC tests depend on it having been done and recorded.

### 3.4 Invites

- **Raw invite token never appears in a logging position** — verified by inspecting server/proxy access logs, error-reporting breadcrumbs, and analytics capture for the invite route; the token travels in the URL **fragment**, is delivered to the redemption endpoint by **POST body only**, and the visible URL is replaced client-side afterward (security.md §9.1).
- `token_hash` is **not selectable** by any client role, including an admin managing invites for their own batch (security.md §9, column privilege).
- An invalid, expired, or revoked token returns **one indistinguishable generic response** — verified by asserting byte-for-byte (or at least user-observably identical) responses across all three cases (security.md §9).
- **Use caps**: an invite with `max_uses` set is refused on the use that would exceed the cap.
- **Concurrent single-use redemption**: two redemption attempts fired at (as close to) the same instant against a `max_uses = 1` invite — exactly one succeeds, enforced by the row lock (`SELECT ... FOR UPDATE`) described in database.md §3.4; this is a §5 concurrency test as well as a security test.
- **Redemption never grants an elevated role** — the redeemed membership is always `role = 'member'`, regardless of any role-shaped value present in the request (database.md §3.4, §16).
- **Approval-required redemption produces `pending` with zero access** — no gallery, roster, media, or interaction surface reachable from a pending row (security.md §10).
- **A removed member redeeming a fresh link does not silently reactivate** — their existing `removed` row must not flip to `active` via redemption; reentry requires an explicit mod+ decision (security.md §9).

### 3.5 Direct-DML Column Safety

For every table where ordinary policy-checked direct DML exists (security.md §5.4.1), an **otherwise-legitimate** update by the row's rightful owner is tested attempting to smuggle a forbidden column change — the row-level policy would authorize the update; only column-level enforcement can catch this, which is exactly why these are tested separately from §3.2–3.3's row-level cases:

- `memories`: author updates their own memory, attempting to also change `batch_id` (relocating it into another batch) and separately `created_by` — both rejected; only `caption`, `event_name`, `occurred_on` are writable.
- `comments`: author updates their own comment, attempting to change `memory_id` or `batch_id` (relocating it) and separately `author_id` — both rejected; only `body` is writable.
- `reactions`: owner updates their own reaction, attempting to rewrite `profile_id`, `memory_id`, or `batch_id` — rejected; only `kind` is writable.
- `profiles`: owner updates their own row, attempting to rewrite `id` or set a deletion/system field — rejected (repeated from §3.1 for completeness of this checklist).
- **Identity-binding on insert**: a caller inserting a comment or reaction supplies an `author_id`/`profile_id` other than their own — rejected, or overridden by the database default to `auth.uid()`; the forged value must never persist (security.md §5.4.1, §5.6).
- **Controlled system-field write paths keep their protection** (security.md §5.4.3): for every protected field that has a legitimate controlled path — `onboarding_completed_at`, `avatar_path`, and (only if PRD #7 permits it) `memories.deleted_at`/`deleted_by` — the ordinary-DML refusal is tested *alongside* the legitimate path, and the controlled path is tested to expose **no other column**. Two conditional cases: **memory author self-delete** is tested only once PRD #7 is decided, and exactly as decided (including any time limit); **comment author self-delete** has no MVP test scope at all, because `phases.md` Phase 6 does not ship it and its rules are **not** assumed identical to the memory case.
- **Parent-resource visibility on write**: a direct-DML write (a comment, a reaction) is attempted against a parent memory that is **not visible** to the caller — soft-deleted, moderator-removed, or in a batch the caller is not an active member of — refused, including when the caller holds a memory id from before it became invisible (security.md §5.4.2). This is the write-side twin of §3.9's read-side test.

### 3.6 Storage

Called **directly against the Storage REST API by path**, not through the app (security.md §7, §7.1):

- All buckets are private — no unauthenticated request to any bucket succeeds.
- A non-member cannot read batch media in a batch they are not in.
- A pending requester, a rejected requester, and a removed member each cannot read batch media.
- An object in a **soft-deleted batch** is not fetchable, even by an otherwise-active member.
- An object belonging to a **soft-deleted or moderator-removed memory** is not fetchable by an otherwise-active member — this is the case security.md §7.1 calls out as the one that actually distinguishes Storage RLS from a bare membership check: *deleted rows must not leave fetchable bytes.*
- An object whose `media_assets.deleted_at` is set is not fetchable.
- A `pending` object is readable **only by its uploader**, and only as far as the upload/finalize flow genuinely requires.
- A `rejected` object is **never generally readable** by anyone.
- A member attempts to **upload to a path they did not preallocate** — refused.
- A member attempts to **upload to another member's pending media id** — refused.
- A member attempts to **overwrite an existing `ready` object** — refused; finalized archive content is not client-writable.
- An **ordinary member attempts to delete a Storage object directly** — refused; deletion belongs only to the trusted rejection/retention/cleanup flows running with system authority.
- **Avatar reads follow profile/shared-batch visibility** exactly as §3.1 describes, tested here at the Storage layer directly.
- **Future note, not an MVP gate:** once time-capsule locking ships (post-MVP, §3.12), the same Storage-authorization principle requires that a sealed memory's underlying media is not fetchable by path before unlock — recorded here so the pattern is not forgotten when that feature arrives, not tested now.
- **R2 — a cached media response must never outlive the viewer's authorization.** Whichever resolution architecture §9's (a)/(b) derivative choice and the Q4 decision take, this is tested regardless: if delivery relies on Storage-side transformations, the transformed derivative is authorized by the same Storage RLS as the original (§3.6's cases apply to derivative paths too); if an application-authorizing media route is introduced instead, that route is a **new authorization surface** and gets the full §3.6 adversarial treatment plus a check that its response carries `Cache-Control: private, no-store` (architecture §11; security.md R2). This is a `phases.md` Phase 4A design decision, re-verified in Phase 5A once the gallery is the thing actually requesting media at volume.

### 3.7 Signed URLs — the Adopted Option B Model

Tests must reflect exactly what security.md §8 and §8.1 establish, and must not overclaim:

- **Application-minted URLs are short-lived per the application's TTL policy** (the exact TTL value is R1, still open — test the *mechanism* — that a minted URL stops working after its stated TTL — not a specific number until R1 is decided).
- A signed URL is a **bearer capability for one object**, valid until expiry, usable by anyone who holds it — test that possession, not viewer identity, is what Storage checks once a URL is minted.
- **An already-minted URL survives membership removal until it expires** — test that removing a member does not retroactively invalidate a URL they were handed before removal; this is the documented, accepted limitation (security.md R1), not a bug to "fix" in a test.
- **Do not assert that the application's TTL globally constrains a client-minted URL.** A member who calls the signed-URL API directly (which they can, because minting requires only the same Storage `SELECT` permission an ordinary read requires, security.md §8.1) chooses their own expiry. A test must not claim the app's TTL policy bounds this case — that would misstate what the control actually provides. If server-only minting is ever adopted (Option A), it requires its own proven, tested distinction between "create a signed URL" and "read an object" in the deployed environment (security.md §8.1) before any test may assume it holds.
- **Do not treat application-level signed-URL-minting rate limits as a complete privacy boundary.** They throttle the *application's* path only; a member calling Storage directly to mint URLs for content they can already see is not bypassing anything — they already had that access. Test the rate limit as a throttle (§3.4-adjacent abuse-pacing concern), never as an authorization control.

### 3.8 Media Validation Model

Preserving the exact boundary architecture ADR-08a and security.md §14 draw — tests must never claim more than what MVP actually proves:

- **Actual stored byte size is authoritative** at finalize — test that the size compared against the cap is the size Storage reports for the stored object, never the client-declared value.
- **Storage-reported Content-Type is metadata enforcement, not proof of bytes** — test that finalize checks the reported type against the allowlist, and separately, explicitly document/assert in the test's own description that this does **not** prove the file's actual contents (a test must not be written in a way that implies otherwise, e.g., by naming itself "verifies file is actually a JPEG").
- **Intrinsic file type, codec, and duration are NOT authoritatively inspected in MVP** — there is no test asserting the server proved a video's codec or duration; tests for these are explicitly client-side-only UX checks, and any test suite item implying server-side proof of them is a defect in the test suite itself, not a passing feature.
- **Client pre-checks are UX only** — test that a request bypassing the client check entirely (calling the RPC directly with an over-limit or wrong-type declaration) is still caught at finalize by the two authoritative checks above, proving the client check was never the real gate.
- **SVG is rejected** — `image/svg+xml` (and any other non-allowlisted type) refused at finalize, regardless of what the client declared.
- **Rejected bytes are deleted object-first** — a finalize rejection results in the Storage object being deleted (or confirmed already gone) **before** the row is removed; test the ordering, not just the end state, since the ordering is what prevents an orphaned pointer (database.md §3.6, §24).
- **Finalize is idempotent** — calling finalize twice for the same upload identifier produces one memory, not two (architecture §18.8).
- **Orphan/rejected cleanup is idempotent** — running the sweep twice is harmless; deleting an already-absent object is a no-op (database.md §3.6).
- **R9 — media response headers must be verified before release, not assumed.** A test (or a documented manual verification step, since this may not be fully automatable against the real Storage origin) confirms what Supabase Storage actually returns for each allowed type — `Content-Type`, `X-Content-Type-Options: nosniff`, and `Content-Disposition` — per security.md §15, §32 R9. This is a `phases.md` Phase 4A task and a hard Phase 9 release gate; it is not satisfied by application-level header configuration, since Storage-served bytes do not pass through the app.
- **B1 — EXIF/GPS handling is tested according to whichever option is chosen; that choice is not made here.** Once B1 selects one of security.md §27's four options, testing adapts: *client-side strip* → verify best-effort stripping in the upload client, explicitly documented as unverifiable/bypassable server-side, never asserted as a guarantee; *server-side strip at finalize* → verify the finalized stored object has no GPS/location EXIF while capture date/time is preserved, and decide/verify whether the untouched original is retained privately or discarded; *store original, strip on serve* → verify served bytes lack GPS while access to the unstripped original is itself access-controlled; *accept and disclose* → verify the user-facing disclosure copy is present, accurate, and shown before upload. **Until B1 is decided, there is no EXIF-stripping test in MVP, and that absence is a tracked blocker (B1), not a passing test.**

### 3.9 Comments / Reactions

- **Child visibility follows parent memory visibility, on reads and on writes** (security.md §5.4.2) — a comment or reaction is visible, and may be created, only when its parent memory is currently visible to the caller.
- **No comment or reaction on a deleted or invisible memory** — including replaying a memory id held from before it was soft-deleted or moderator-removed; refused both for a direct read of the comment/reaction and for a new write attempt.
- **Forged author/profile identity is rejected or safely overridden** — a caller supplies `author_id`/`profile_id` other than their own; the value is rejected outright or overridden by the database default to `auth.uid()` — whichever mechanism is chosen, the forged value never persists (security.md §5.4.1).
- **Reaction uniqueness under concurrency** — two near-simultaneous writes for the same `(memory_id, profile_id)` resolve to exactly one row (`UNIQUE (memory_id, profile_id)`, database.md §3.8); this is a §5 concurrency test as well.
- **No thread/reply behavior in MVP** — there is no test asserting nested replies exist, because the schema is deliberately flat (database.md §3.7); a test suite must not add speculative coverage for a `parent_comment_id` that does not exist.
- **No notifications implied** — no test asserts a notification was created, sent, or queued as a side effect of a comment or reaction, because notifications are postponed (architecture §12, §22; `phases.md` Phase 6's explicit exclusion).

### 3.10 Reports / Moderation

- **Report target is resolved server-side** — the RPC derives `target_kind`/`target_id` (and `batch_id`, from the **target's** batch) from the resolved row, never from an unchecked caller assertion (security.md §13; database.md §3.9).
- **Snapshot is immutable** — attempted `UPDATE` of `target_kind`/`target_id` on an existing report refused at the grant level (`REVOKE UPDATE`, security.md §3.9).
- **Reporter identity is hidden from the reported party** — the reported member cannot read the report, see that one exists, or learn who filed it (security.md §18).
- **Non-mod+ cannot read the report queue** — including the reporter themselves, who does not get read access to the queue by virtue of having filed into it.
- **Reports survive target deletion** — deleting the reported memory/comment/membership nulls only the live reference column (column-specific `ON DELETE SET NULL`); the immutable snapshot remains, and the report is not deleted (database.md §3.9).
- **Reports never block deletion** — deleting a reported memory, comment, or membership must not be prevented by an open report against it.
- **Duplicate open-report suppression** — a second open report from the same reporter about the same target (by the snapshot's `(reporter_id, target_kind, target_id)`) is suppressed while the first remains open, and becomes possible again once the first resolves.
- **Moderation removal hides content and its underlying media** — a moderator-removed memory is absent from every member read path, **and** its media object is not fetchable by direct Storage path either (§3.6) — a photo hidden at the row level but still downloadable by path is not removed.
- **Role ceilings on moderator/admin operations** — a moderator attempting to remove an admin, and an admin attempting to create another admin or remove the owner, both refused (security.md §4, §11 — restated here in the moderation context; the general RPC checklist is §3.3).

### 3.11 Deletion / Lifecycle (Gated)

Every item below is a **conditional test plan**, gated exactly as `phases.md` Phase 8B gates the corresponding implementation. None is tested as an MVP gate until its decision is made; none of these decisions is made here.

- **Ownership-transfer atomicity** — the outgoing owner's demotion and the incoming owner's promotion commit together or neither does; a simulated failure between the two leaves the original owner intact, never two owners and never zero (security.md §11; this is also a §5 concurrency test).
- **At most one active owner** — structurally guaranteed by the partial unique index; a test attempting to create a second `role='owner', status='active'` row for one batch fails on the constraint.
- **Owner-account-deletion behavior exactly matches whatever B3/Q3 decides** — *block pending transfer* → test that deletion is refused while the user is the batch's sole active owner and no transfer has occurred, and succeeds once transfer completes first; *auto-promote* → test that the longest-serving admin is atomically promoted in the same transaction as the deletion; *claimable ownerless state* → test that the batch becomes ownerless without becoming inaccessible, and that whatever claim path exists is itself correctly authorized. **Until B3/Q3 is decided, account deletion for a sole owner is not an MVP-tested flow, and shipping it undecided is the tracked blocker, not a passing test.**
- **Batch deletion is object-first** — `media_assets` rows (and their `storage_path`s) are enumerated and their Storage objects deleted or confirmed-absent **before** the batch row is hard-deleted and the subtree cascades; test the ordering directly (e.g., by asserting objects are gone before the row disappears), not only the end state (security.md §24; database.md §24).
- **Deletion retry/idempotency** — re-running a partially-completed deletion (simulating a crash between steps) is safe: an already-absent object is a no-op, and reaching the final hard-delete step twice is harmless.
- **A failure between Storage deletion and DB hard-delete leaves a recoverable state** — specifically, test that this failure mode never leaves the *reverse* problem (a hard-deleted row with objects still stranded, unreachable and undeletable) — that ordering is disallowed absolutely, per security.md §24's "never the reverse: cascade-first is unrecoverable."
- **Soft-deleted batch is invisible, including via direct Storage path** — repeats §3.6's soft-deleted-batch case here in the lifecycle context, since it is the same guarantee exercised by a different trigger.
- **Account deletion retains/nulls attribution exactly as documented** — content (`memories`, `comments`, `media_assets`, `batches.created_by`) survives with authorship `SET NULL`; memberships and reactions **cascade away** (database.md §12; security.md §22) — test both halves of this asymmetry, since a test that only checks "content survives" would miss a regression that accidentally also cascades content.
- **R3 — re-authentication before destructive actions.** Batch deletion and ownership transfer are protected only by session (no MFA in MVP, security.md R3). Test the high-friction confirmation that does exist (naming the batch, an explicit typed/selected step per rules.md §5, design.md §14) as a hard requirement; test an added re-authentication step only if and once it is actually implemented — its absence is a documented, accepted risk (R3), not a defect to fabricate a passing test for.
- **R5 — the audit trail loses actor identity on account deletion, by design.** After an actor deletes their account, test that the corresponding audit row retains the action, its timestamp, and the `actor_role` frozen at the time of the action, while `actor_profile_id` is `NULL` (security.md R5, §20) — this exact asymmetry is the documented, accepted behavior; a test must not treat the nulled identity as a bug, and must not assert the identity is somehow still recoverable.
- **Export scope is tested only once Q9 is decided; Q9 is not decided here.** If/when an export surface is built, testing must verify every invariant security.md §25 lists: never exceeding the caller's own authorized scope, rate-limited, audit-logged, delivery scoped to the requester and short-lived, and the hard exclusions (`token_hash`; audit/moderation records in a member-facing export; any other user's `auth.users` data). **Until Q9 is decided, there is no export test scope, and none is implied by this document.**

### 3.12 Time-Capsule Tests — Resolving `09_TESTING.md` Item 13 as Post-MVP

`09_TESTING.md` names "Time-capsule tests" as a required section (its item 13). Per the source-of-truth rule (this document's header, and `phases.md`'s identical treatment of its own Phase 7), **time capsules are post-MVP** — architecture §22 postpones them, §16 reserves the module boundary, database.md §22 designs them explicitly "Post-MVP. Not created," and PRD §15 lists them as post-MVP. No source document schedules them into MVP testing scope.

This section therefore preserves **future testing considerations only**, not MVP gates: once built, testing must verify that unlock is a **read-time visibility predicate**, never advanced early by a scheduled job (ADR-11; database.md §22); that **every row storing a sealed payload carries its own lock column** (`memories.locked_until` and `time_capsule_entries.locked_until` independently, since a lock on the grouping table protects nothing); and that sealed media is not fetchable by direct Storage path before unlock (extending §3.6's principle). `Q8` — whether a sealed capsule's existence is visible before unlock — must be decided before any of this is testable as a concrete pass/fail; it is not decided here. **None of this is an MVP test.**

---

## 4. Test Data, Fixtures & Personas

**Minimum persona set**, each with a real, distinct authenticated identity (a real JWT, not a role label) so RLS and RPC tests exercise genuine `auth.uid()` resolution:

| Persona | State | Purpose |
|---|---|---|
| Unauthenticated visitor | No session | Baseline denial-by-default checks (security.md §5.1) |
| Active member | `status='active'`, `role='member'`, Batch A | The default "should work" case |
| Moderator | `status='active'`, `role='moderator'`, Batch A | Moderation-tier capability boundary |
| Admin | `status='active'`, `role='admin'`, Batch A | Admin-tier capability boundary |
| Owner | `status='active'`, `role='owner'`, Batch A | Owner-only capability boundary |
| Pending requester | `status='pending'`, Batch A | "Pending is not access" (security.md A3) |
| Rejected requester | `status='rejected'`, Batch A | Rejection history without reactivation |
| Removed former member | `status='removed'`, Batch A, previously `active` | Immediate loss of access; A2's adversary |
| Member of another batch | `status='active'`, `role='member'`, **Batch B only** | Cross-batch isolation's adversary |
| User belonging to two batches | `status='active'` in **both** Batch A and Batch B | PRD §16's multi-batch isolation edge case; proves seeing exactly two batches' worth of data, no more |

**At least two isolated batches (Batch A, Batch B)** exist in every fixture set specifically so cross-batch attacks (§3.2, §3.3 item 3) have a real second batch with real content to fail against — a single-batch fixture set cannot exercise this class of test at all.

**Fixture and seeding principles:**

- **No hidden shared state.** Every test run seeds its own personas and batches with unique, generated identifiers (emails, display names) rather than relying on a fixed set of rows other tests might also mutate. Two tests running in the same CI job must not be able to interfere with each other.
- **Reset per test, not per suite.** Where the harness supports it, wrap each §2.3/§2.4 test in a transaction rolled back at the end; where it does not (e.g., a case that must observe a real commit, like concurrency tests in §5), reseed explicitly rather than assuming a clean slate from a prior test's cleanup.
- **Local/ephemeral only.** All of §2.3–2.5's fixtures live in a disposable local Supabase stack or an isolated, non-shared test project — never production, never a preview project other work might be using concurrently (architecture §15's environment-isolation principle, applied to test infrastructure).
- **Repeatable locally and in CI.** The same seeding script produces the same persona/batch shapes whether run on a developer's machine or in CI, so a failing test is reproducible outside CI.
- **Known-state media fixtures.** For §2.4/§3.6/§3.8, fixtures include objects pre-seeded in each relevant `media_assets.status` (`pending`, `ready`, `rejected`) and parent states (soft-deleted memory, soft-deleted batch) so Storage tests do not need to drive the full upload pipeline just to reach the state under test.

---

## 5. Concurrency & Transaction Tests

Operations whose correctness depends on what happens when two requests arrive close together — each of these needs an explicit test that fires (as close to) simultaneous requests and asserts the atomic, race-free outcome, not just the single-request happy path:

| Operation | Race being tested | Required atomic outcome |
|---|---|---|
| **Create batch + owner** | A simulated partial failure between inserting the batch and inserting the owner membership | Both rows exist, or neither does — never a batch with no owner (security.md §5.2.1) |
| **Invite redemption / `use_count`** | Two redemptions racing to increment `use_count` on the same invite | The row lock (`SELECT ... FOR UPDATE`) serializes them; `use_count` never exceeds `max_uses` |
| **Single-use invite** | Two redemptions of a `max_uses = 1` link fired together | Exactly one succeeds; the other sees the invite as already exhausted |
| **Membership status transitions** | Two decisions on the same pending request (e.g., simultaneous approve and reject) | Exactly one transition wins; the row ends in one consistent state, not a torn write |
| **Role changes** | Two role-change calls targeting the same member at once | The final role reflects one coherent operation; ceilings (§3.3 item 6) are checked against the *current* state at the time each transaction actually commits, not a stale read |
| **Ownership transfer** | A transfer racing against another role change on either party | The exactly-one-owner constraint holds throughout; a conflicting concurrent operation fails cleanly rather than producing two owners |
| **Reaction uniqueness** | Two near-simultaneous reaction writes for the same `(memory_id, profile_id)` | `UNIQUE (memory_id, profile_id)` resolves to exactly one row; no duplicate-key crash surfaces as an unhandled error |
| **Media finalize** | A retried finalize call for the same upload identifier, potentially overlapping with the first attempt | Exactly one memory is created; the second call recognizes `memory_id` already set and returns the existing memory (architecture §18.8) |
| **Deletion workers** | The orphan/rejected sweep, or the batch/account deletion worker, running twice (e.g., a retried cron invocation) | Idempotent: an already-deleted object or already-hard-deleted row is a no-op, never a duplicate action or an error that blocks the next run |

---

## 6. CI / Quality Gates

Aligned exactly with `phases.md`'s Quality Gates table and `rules.md` §7 — no gate here that those documents do not already name, and no gate there omitted here.

| Gate | Tool | Applies |
|---|---|---|
| Lint | `pnpm lint` (ESLint) | Every phase |
| Typecheck | `tsc` (strict, per rules.md §1.1) | Every phase |
| Unit + integration tests | Vitest | Every phase |
| Browser E2E | Playwright | Every phase with a user-facing flow (1–6, 8, 9 — see §12) |
| Production build | `next build` | Every phase |
| Dependency audit | `pnpm audit` (high-severity fails the gate) | Every phase |
| Adversarial DB/RLS/RPC/Storage suite | Vitest (§2.3–2.4) | Every phase that creates or touches a table, policy, RPC, or Storage path (0–4, 6, 8, 9) |
| Accessibility + reduced-motion | Playwright + automated a11y scan (§2.6) | Every phase shipping UI |

**Every gate above is reported using the four-way distinction in §1** — configured, executed, passing, or explicitly skipped/not-applicable with a stated reason. A phase's Definition of Done is never satisfied by a gate that was merely configured. No exceptions, and this rule is itself carried forward unchanged into every phase in `phases.md`.

---

## 7. Playwright Core E2E Flows

Mapped to the MVP loop and to the phase that introduces each step (`phases.md`). Steps gated by an unresolved decision are marked; they enter the E2E suite only once their gate is resolved and the corresponding `phases.md` phase actually ships.

| Flow step | Phase | Status |
|---|---|---|
| Signup | 1 | MVP |
| Verification / login | 1 | MVP |
| Onboarding | 1 | MVP |
| Create batch | 2 | MVP |
| Create / share invite | 3A | MVP |
| Redeem → join, or → pending approval | 3A | MVP |
| Membership approval (mod+ decides a pending request) | 3B | MVP |
| Upload photo | 4A | MVP |
| Upload short video | 4B | MVP |
| Gallery | 5A | MVP |
| Timeline | 5B | MVP |
| Memory detail | 5A | MVP |
| Comment | 6 | MVP |
| Reaction | 6 | MVP |
| Report | 8A | MVP |
| Moderation (queue review + removal) | 8A | MVP |
| Role change / ownership transfer | 3B | MVP |
| Lifecycle / destructive flows (batch deletion, account deletion, export) | 8B | **Gated — enters the suite only once B3/Q3, PRD #6, Q7, and (for export) R10/Q9 are decided; not run against undecided behavior** |

**Responsive coverage** runs each applicable flow at mobile, tablet, and desktop breakpoints (design.md §22–24) — mobile is the primary designed-first target and gets the fullest coverage; tablet/desktop coverage focuses on layout adaptation (§9's performance note and §2.6's accessibility pass apply at every breakpoint, not mobile only).

**No post-MVP feature appears in this table** — no album, notification, time-capsule, yearbook, or showcase step (§11).

---

## 8. Performance Testing

Scoped to PRD §20's actual expectations, not invented beyond them:

- **Incremental gallery loading**: verify the gallery never fetches the whole archive at once — a paginated/keyset request pattern is observed under test, not a single unbounded query (PRD §20; architecture §19; `phases.md` Phase 5A).
- **Upload feedback under network variance**: verify upload progress is real and responsive, and that a simulated network interruption during upload does not silently fail — it surfaces a retryable state (PRD §20; architecture §8).
- **Memory detail promptness**: verify the primary asset (poster/blur placeholder) is visible quickly on first open, with heavier media (video) allowed to load progressively rather than blocking the page (PRD §20).
- **Mobile-network-class conditions**: performance checks run under a throttled/mobile-class network profile in Playwright, not only on a fast local connection, since PRD §20 specifically requires usability on "typical mobile network conditions."
- **Never at the cost of privacy**: performance testing never validates a pattern PRD §20 explicitly forbids — fetching a superset of data and filtering client-side for speed (architecture §11) is a **failing** pattern if ever observed, regardless of how fast it appears.

This is a `phases.md` Phase 9 gate ("performance verification against PRD §20"); earlier phases may include narrower checks (e.g., Phase 5A's pagination correctness) without claiming the full performance gate is satisfied until Phase 9.

---

## 9. Error-State & Retry/Failure Testing

- **Generic, indistinguishable errors**: every "not found" and "not authorized" case (§3.2's cross-batch/non-member tests, §3.4's invalid-invite test) is verified to produce the **same observable shape** to the caller, per security.md §3's "indistinguishable denial" and design.md §20.
- **Upload retry/idempotency**: covered in depth by §3.8 and §5 — a failed or retried upload/finalize never produces a duplicate memory or a permanently broken record.
- **Invite redemption retry**: a retried redemption call (e.g., a client that resubmits after a timeout) does not double-consume `use_count` beyond what a single logical redemption should — this is a specific instance of §5's redemption concurrency test applied to the single-caller-retry case rather than the two-caller-race case.
- **Deletion retry**: covered by §3.11 and §5 — deletion workers are idempotent under retry.
- **Cron/route-level failure**: an unauthenticated call to a cron route (missing or wrong shared secret) is refused **before the body is parsed** (architecture §18.9) — tested as its own case, since parsing-then-rejecting would still process untrusted input.
- **Client-side network failure**: a Playwright test simulates a dropped connection mid-upload and verifies the UI surfaces a retry affordance rather than a silent or ambiguous failure (design.md §5, §18).

---

## 10. Production Smoke Testing

A minimal, fast, high-confidence check that a deployed build is alive and not catastrophically broken — distinct from the full regression suite (§2.8), which is heavier and reserved for pre-release:

- The app boots and serves its landing page.
- Authenticated session establishment works end to end (a real login succeeds).
- No client bundle contains the service-role key (security.md §12; architecture §15) — this specific check is cheap enough to run on every deploy, not only at release.
- No public Storage bucket exists (a direct unauthenticated Storage read against each bucket fails).
- Core Web Vitals / basic responsiveness is not catastrophically regressed (a coarse check, not the full §8 performance suite).

Configured from Phase 0 onward (the app-boots case exists as soon as there is an app to boot); the full list above is meaningful starting once auth (Phase 1) and Storage (Phase 4A) exist. Smoke testing is never a substitute for the phase-specific gates in §6 — it is a fast tripwire for "something is badly broken," run on every deploy, while §6's gates run per-phase and §2.8 runs pre-release.

---

## 11. Post-MVP Testing Boundaries

None of the following is an MVP test gate. Each is preserved as a **future testing consideration** so it is not designed from zero when the corresponding feature eventually ships — consistent with `phases.md`'s identical treatment of these same capabilities.

| Capability | Future testing consideration (not MVP) |
|---|---|
| **Albums** | Once built: album-membership composite FKs enforce same-batch scoping exactly like every other child table (database.md §14); album visibility inherits from batch membership, never a separate looser rule |
| **Notifications** | Once built: notification payloads carry references only, never content (architecture §12); a recipient removed from a batch stops seeing its notifications by the same rule that stops them seeing its memories; no dependency on an email provider is assumed |
| **Time capsules** | See §3.12 — read-time unlock predicate, per-row locks, Storage-path blocking before unlock; Q8 must be decided first |
| **Yearbook** | Once built: self-authored entries vs. peer-authored notes are tested as separate authorship/visibility surfaces (database.md §23); one page per member per batch is enforced; draft pages are never visible before `published_at` |
| **Public showcase** | Once built (explicit opt-in only, ADR-12): publication is tested as a **copy** operation into a separate bucket, never a permission relaxation on the private original; the private row's policy is verified unchanged after publication |
| **Advanced search / discovery** | Batches remain non-discoverable in MVP (security.md §10) — any future search/discovery feature is tested to confirm it introduces no new way to enumerate batches or content outside existing authorization, before it is trusted |
| **Richer media processing / transcoding** | Any future `ffprobe`-class inspection step is tested to confirm it does not change the two-phase upload's shape (architecture §10) and does not silently start claiming authoritative duration/codec proof retroactively for MVP-era content |
| **AI features** | None planned before the core product works well for real users (`00_READ_ME_FIRST.md`); no test scope exists yet |

---

## 12. Phase Alignment (mapped to `phases.md`)

| Phase | New test surface this phase adds | Gates required (§6) |
|---|---|---|
| **0 — Foundation** | Env-schema unit tests; **B2 verification** (SECURITY DEFINER/FORCE RLS proof + membership-helper-oracle negative test, §3.3); Storage-bucket-privacy check; service-role-key-absent-from-bundle check | lint, typecheck, Vitest, Playwright smoke, build, audit |
| **1 — Auth & Profile** | `profiles` adversarial suite (§3.1), including the **onboarding-completion matched pair** (legitimate controlled path succeeds; direct write still refused); signup/verify/onboarding/logout E2E; a11y pass | + adversarial suite, a11y |
| **2 — Batch Spaces** | `batches`/`batch_members`/`audit_logs` adversarial suite (§3.2); the batch_members-INSERT test; ownerless-batch-impossible test; create-batch/settings E2E | + adversarial suite, a11y |
| **3A — Invitations & Join** | `batch_invites` adversarial + token-logging suite (§3.4); redemption/use_count concurrency (§5); invite/join E2E | + adversarial suite |
| **3B — Membership Decisions & Roles** | Role/removal/ownership-transfer adversarial suite (§3.3, §3.11's transfer-atomicity item); membership-management E2E | + adversarial suite |
| **4A — Photo Upload Pipeline** | `memories`/`media_assets` adversarial + Storage suite (§3.5, §3.6, §3.8); finalize idempotency/concurrency (§5); **R9 header-verification task**; upload E2E | + adversarial Storage suite |
| **4B — Video, Edit/Delete, Reliability** | Video constraint tests; edit/delete column tests (§3.5); sweep idempotency (§5); video upload/edit E2E | + adversarial suite |
| **5A — Gallery & Memory Detail** | Pagination correctness; soft-deleted-absent-from-every-read-path test; gallery/detail E2E; a11y + reduced-motion | + a11y |
| **5B — Timeline & Event Grouping** | Grouping/filter correctness; timeline E2E; a11y | + a11y |
| **6 — Comments & Reactions** | `comments`/`reactions` adversarial suite (§3.9); reaction-uniqueness concurrency (§5); comment/reaction E2E | + adversarial suite |
| **7 — (No MVP scope)** | None — time capsules and yearbook are post-MVP (§3.12, §11) | n/a |
| **8A — Reporting & Moderation** | `reports` adversarial suite (§3.10); moderation E2E | + adversarial suite |
| **8B — Batch & Account Lifecycle (Gated)** | Lifecycle adversarial suite (§3.11), entered only once B3/Q3, PRD #6, Q7 are decided; object-first/idempotency/concurrency tests (§5); lifecycle E2E once gates resolved; export tests only if Q9/R10 resolved | + adversarial suite |
| **9 — Quality & Production Readiness** | Full regression re-run (§2.8) of every adversarial suite via REST/Storage directly; B1, B4, R9, R4, R6 release-gate verification; full performance suite (§8); backup/restore drill; full a11y audit | all gates, full suite |

---

## 13. `09_TESTING.md` Requirement Mapping

Confirms every item the original prompt required has an explicit home in this document.

| Prompt item | Section |
|---|---|
| 1. Testing philosophy | §1 |
| 2. Unit-test scope | §2.1 |
| 3. Integration-test scope | §2.2 |
| 4. End-to-end-test scope | §2.5, §7 |
| 5. Database/RLS tests | §2.3, §3.2, §3.5, §3.6 |
| 6. Permission tests | §3.2, §3.3, §3.5 |
| 7. Authentication tests | §3.1 |
| 8. Invitation tests | §3.4 |
| 9. Upload tests | §3.8, §5 |
| 10. Media-access tests | §3.6, §3.7 |
| 11. Comment/reaction tests | §3.9 |
| 12. Moderation tests | §3.10 |
| 13. Time-capsule tests | §3.12 — **resolved as post-MVP**, not an MVP gate (source-of-truth rule) |
| 14. Export/deletion tests | §3.11 — gated, not decided here |
| 15. Accessibility tests | §2.6 |
| 16. Responsive tests | §7 |
| 17. Performance tests | §8 |
| 18. Error-state tests | §9 |
| 19. Retry/failure tests | §9 |
| 20. Production smoke tests | §10 |

---

## Critical Security Tests

1. A non-member cannot access a private batch — gallery, roster, detail, comments, or reactions — through any read path (§3.2).
2. A non-member cannot access private media, including by direct Storage path (§3.6).
3. A member of Batch A cannot read or write into Batch B, even with known UUIDs (§3.2, §3.3).
4. A normal member cannot perform owner/admin-only actions, and role ceilings hold even when the actor forges their role in the request payload (§3.3, §3.10).
5. Expired, revoked, and never-valid invites all return one indistinguishable response and grant nothing (§3.4).
6. A removed member loses access immediately and cannot silently reactivate via a fresh invite (§3.4).
7. Deleting a memory, comment, or batch follows the documented soft-delete → object-first-hard-delete policy, with no path where bytes outlive their row pointer (§3.8, §3.11).
8. Upload failure never creates a permanent, broken, or unadmitted record — rejected bytes are deleted, abandoned rows are swept (§3.8, §5).
9. RLS cannot be bypassed through normal client credentials — most importantly, a direct PostgREST `INSERT` into `batch_members` supplying a batch id fails (§3.2).
10. The privileged-function execution model (`SECURITY DEFINER` / `FORCE RLS` / owner/`BYPASSRLS`) is verified in the real Supabase environment before any dependent RPC or membership-helper-based policy is trusted — B2 (§3.3).
11. Column-level forgery on an otherwise-legitimate row update (`batch_id`, author/profile id, deletion fields) is rejected at the database, never merely hidden by the UI (§3.5).
12. Reporter identity is never disclosed to the reported party, and a report never blocks deletion of its target (§3.10).

## Minimum Pre-Merge Quality Gate

- `pnpm lint` — clean.
- Strict TypeScript typecheck — clean.
- Vitest suite (unit + integration) — green.
- Playwright suite — green, for any change touching a user-facing flow.
- `next build` — succeeds.
- `pnpm audit` — no unresolved high-severity findings.
- The adversarial RLS/RPC/Storage suite (§2.3–2.4) — green, for any change touching a table, policy, RPC, or Storage path.
- Accessibility + reduced-motion check — green, for any change shipping UI.
- **All of the above actually executed in this session, with output observed — never assumed from configuration, and never merged on the strength of "the plan says this should pass."**

---

STOP — Prompt 09 complete. No tests, application code, SQL, or migrations were created, and no packages were installed. `docs/memory.md` (Prompt 10) is **not** started. Awaiting the next instruction.
