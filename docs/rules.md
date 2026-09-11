# BatchVault — AI / Coding Rules

Status: Draft — MVP coding rules
Sources of truth: `/docs/project-context.md`, `/docs/PRD.md`, `/docs/architecture.md`, `/docs/database.md`, `/docs/security.md`
Prepared per: `/prompts/06_RULES.md`

**What this document is.** This document invents no new architecture, schema, or security behavior. It translates decisions already made in the five documents above into rules that govern how *code* gets written, once code-writing begins. Every rule below is either a direct restatement of an existing decision — phrased as an instruction to a coding agent — or a coding-level convention (naming, file layout, library discipline) filling a gap those documents deliberately left to the implementation step. This document is what future AI coding sessions read before touching a keyboard.

**Precedence.** Where anything here conflicts with `project-context.md`, `PRD.md`, `architecture.md`, `database.md`, or `security.md`, those documents win and this document is wrong — fix this document to match them, never the reverse. This file elaborates the repository's `CLAUDE.md`; it does not supersede it.

**Scope.** This document governs implementation once it starts. It does not itself authorize starting implementation — that remains gated by `08_PHASES.md` and the numbered phase prompts (`12`–`21`). Writing this file is not permission to begin Prompt 07 or any later prompt.

---

## 1. Technology Rules

### 1.1 TypeScript & strict typing

- **Strict mode is non-negotiable.** `tsconfig.json` sets `"strict": true` plus `noUncheckedIndexedAccess` (architecture §2). Do not relax these to make a build pass.
- **No implicit `any`.** Hand-written `any` is a smell, not a convenience — see §3 for the one tolerated exception and what it requires.
- **No unchecked non-null assertions (`!`) in application code.** Narrow or handle a possibly-null value; do not silence the compiler.
- **Database types are generated, never hand-maintained.** Types under `/types` are generated from the live schema (architecture §6, "typed end-to-end") and imported by each feature's data layer. A hand-written duplicate of a table shape is a drift risk and is not permitted once generation exists.
- **Domain types live beside the domain** in `features/<domain>/types.ts` (architecture §16); other domains import them rather than redeclaring them.
- Server Action results are discriminated unions — `{ ok: true, data }` \| `{ ok: false, error }` (architecture §18.2) — not thrown exceptions used as control flow for expected failures.

### 1.2 Next.js conventions

- **App Router. React Server Components by default.** A file becomes a Client Component (`"use client"`) only for interactivity, browser APIs, or Framer Motion state (architecture §2), and that boundary is pushed as far down the tree as possible.
- **Server Actions are the default write surface.** Route Handlers exist only for cron endpoints, third-party webhooks, and media routes that must stream bytes or set custom headers (architecture §18).
- **Fixed order of operations, every time, no step skipped:** `authenticate → validate input → authorize (membership + role) → execute → revalidate → return` (architecture §18.3). Validating before authorizing means an authorization check never runs against a malformed value; authorizing before executing is the entire authorization model (security.md §3).
- Server Actions are marked `"use server"` and defined in the owning module's `actions.ts` — never written inline inside a component file (architecture §18.1).
- **Never accept a caller-supplied user identity, role, batch-ownership claim, or storage path.** The acting user comes only from the verified session; everything else is re-derived server-side (architecture §18.4–5, security.md §13).
- Mutations name and revalidate the specific cache tags/paths they affect (architecture §11) — never a blanket revalidation "to be safe."
- Protected routes are guarded server-side (redirect to sign-in) — never by hiding a nav link and hoping (architecture §4).
- Middleware refreshes the Supabase session on every request and does nothing else; it is not a place for business logic (architecture §4).

### 1.3 Supabase conventions

- **Two client types, never blurred:** a user-scoped client (anon key + session; browser and server) for ordinary reads/writes, and a service-role client (server-only, narrow call sites) for the short, audited list of system-authority operations (architecture §6, security.md §12). Default to the user-scoped client; a service-role call site is a reviewed exception, never a convenience.
- **The service-role client lives in exactly one server-only module.** Never imported into a Client Component, never reachable from browser-bundle code, and its key never carries a `NEXT_PUBLIC_` prefix (architecture §15, security.md §12).
- **RLS is enabled and forced on every table from the migration that creates it.** No table ships "for now, policies later" (security.md §5.1).
- **Direct client-side table reads are allowed only where the query carries no business logic and is inherently RLS-safe** (architecture §6). Anything with a rule attached goes through a Server Component or Server Action.
- **High-risk writes are RPC-only** (security.md §5.2): batch creation, invite issuance/redemption, membership approval/rejection/removal, role changes, ownership transfer, media preallocation/finalize, report creation, audit-log writes, and batch deletion/restoration never go through direct client `INSERT`/`UPDATE`/`DELETE`. They are called through the specific SQL functions `database.md` and `security.md` describe for each operation.
- **A privileged (`SECURITY DEFINER`-style) database function is security-critical code.** It derives the caller from `auth.uid()`, never accepts caller-asserted identity or role, uses fully schema-qualified names, pins a safe `search_path`, contains no dynamic SQL, and gets adversarial tests before anything depends on it (security.md §5.2.2, §5.3).
- **Storage access follows the same posture as table access.** All buckets are private; the client never chooses or influences an object path (architecture §7, security.md §6). Only the `media` module talks to Storage (architecture §17).

### 1.4 Migration conventions

*(No migrations exist yet. The repository is still in the documentation phase per `06_RULES.md`. These conventions govern the first and every later migration, most likely starting in `12_PHASE_0_FOUNDATION.md`.)*

- **`database.md` is the schema's specification.** A migration implements what `database.md` already describes; it does not introduce a table, column, index, or constraint absent from that document. If implementation reveals `database.md` was wrong, update `database.md` first, with reasoning, then write the migration to match it — the two are never allowed to silently drift apart (CLAUDE.md rule 5).
- Every table is created with **RLS enabled and `FORCE ROW LEVEL SECURITY`** in the same migration that creates it (security.md §5.1) — not a follow-up migration.
- Primary keys are `uuid default gen_random_uuid()` except `audit_logs`, which uses a `bigint` identity column, per `database.md` §3's stated conventions.
- Timestamps are `timestamptz`, never bare `timestamp`, except the one deliberate `date` column (`memories.occurred_on`, `database.md` §3.5).
- Strings are `text` with a length `CHECK`, never `varchar(n)` (`database.md` §3 conventions).
- Batch-scoped tables carry `batch_id` directly and reference their parent via the composite-FK pattern in `database.md` §14 — never a relationship that must be reconstructed with a join before RLS can use it.
- Column-specific `ON DELETE SET NULL (column)` is used exactly where `database.md` §10.2 specifies it. A bare `ON DELETE SET NULL` on any of those six foreign keys is a defect, not a style choice — it aborts the delete at runtime.
- **The only trigger in the schema is the shared `set_updated_at()` housekeeping trigger** (`database.md` §11). No new trigger encodes business logic — counters, cascades, audit writes, notification fan-out, and state transitions all belong in an explicit SQL function (architecture §6, `database.md` §11), where review can see them.
- Migrations are additive by default and reviewed like any other security-relevant change. A destructive migration (dropping a column or table holding real content) gets the same care as batch deletion — it is never routine.
- RLS **policies**, when written, implement the per-table behavior `security.md` §5.4 already specifies — they are not a fresh reinterpretation of it.

### 1.5 Component conventions

- **shadcn/ui components are vendored in-repo** under `components/ui/` (architecture §16) and, once copied, are treated as our code — reviewed and edited in place, not silently bumped by a package update (security.md §30).
- **Tailwind CSS is the styling mechanism.** No competing styling system (CSS-in-JS, a second utility framework) is introduced without updating `architecture.md` first.
- **Shared Framer Motion wrappers live in `components/motion/`** (architecture §16); all motion respects `prefers-reduced-motion` (architecture §2, PRD §19) — a component that animates without checking reduced-motion is not finished.
- **Mobile-first.** Build and verify the small-screen layout first, then enhance up (project-context §9.4, PRD §10.3).
- Domain-specific UI lives in `features/<domain>/components/`, not in `components/` — `components/` holds domain-agnostic, reusable UI only (architecture §16).
- Images render through `next/image` where practical, but the signed-URL-vs-image-optimizer tension is a **named, unresolved architectural risk** (architecture §9, summary risk #3) — do not treat it as quietly solved by using `next/image` alone; whichever resolution is chosen must guarantee a cached response never outlives the viewer's authorization.
- A component that reads batch data directly, bypassing its domain's `queries.ts`, violates §4 below regardless of how well it is styled.

### 1.6 Validation conventions

- **Every Server Action and Route Handler input is parsed and validated against a schema at the boundary** before anything else happens (architecture §3.2, security.md §13). No handler trusts a client-shaped object.
- **One schema-validation approach, chosen once and used everywhere** — for example, Zod. The specific library is a Phase 0 decision, made a single time and not revisited or duplicated per feature.
- **Allowlist, never denylist.** Unknown fields are rejected outright, not stripped and silently ignored (security.md §13) — silently dropping a field hides both bugs and probing.
- **Validation limits mirror the database `CHECK` constraints** (string lengths, ranges) so a bad request fails early with a clear message instead of surfacing as a raw constraint violation later (security.md §13).
- **UUIDs are validated as UUIDs** before they reach a query.
- **Never trust the following from client input, no matter what the schema allows through:** the caller's own identity, role, or membership status; a batch-ownership claim; a storage path; `use_count` or any server-maintained counter; and system timestamps (`created_at`, `expires_at`, `revoked_at`, `deleted_at`, and the like). These are re-derived server-side regardless (security.md §13).
- **One precise exception:** content timestamps the product genuinely asks the user for — currently only `memories.occurred_on` — are legitimately user-supplied and validated as ordinary content, not treated as a system timestamp (security.md §13, `database.md` §3.5).

---

## 2. What to Use

The approved stack (project-context §10, and `architecture.md` throughout). Prefer the simplest option already on this list before reaching for something new:

- **Next.js (App Router)**, React Server Components as the default rendering mode.
- **TypeScript in strict mode**, everywhere, including config and scripts.
- **Tailwind CSS** for styling; **shadcn/ui** (vendored) for base components.
- **Framer Motion** for animation and transitions, always reduced-motion-aware.
- **Supabase Auth**, using the supported Supabase SSR cookie/session strategy (architecture §4) — not a hand-rolled session mechanism.
- **Supabase Postgres** as the single database, via the user-scoped or service-role client as appropriate (architecture §6).
- **Supabase Storage**, private buckets only, accessed through the `media` module (architecture §7, §17).
- **Vercel** for hosting, **Vercel Cron** for the small set of scheduled sweeps (architecture §13).
- **A single schema-validation library** at every input boundary (§1.6).
- **Sentry (or an already-agreed equivalent)** for error reporting, server and client (architecture §14, security.md §21).
- **A single structured (JSON) server-side logger** carrying request/user/batch correlation ids (architecture §14).
- **Keyset/cursor pagination** — never offset pagination — for incremental list views such as the batch gallery (architecture §19, supported by the index in `database.md` §10 #2).
- **`useOptimistic` (or equivalent local optimistic state)** for reactions and comments; no global client-side state manager for server-owned data (architecture §2).

Everything on this list was already chosen in an earlier document. Adding to it is an architecture change — propose it by updating `architecture.md` first, not by importing it into a feature.

---

## 3. What to Avoid

- **Unnecessary dependencies.** Every server-side package runs in the same process as the service-role key (security.md §12, §30); a new dependency is a reviewed decision weighed against what it costs, not a convenience. Prefer the standard library, Next.js, or something already in `package.json`.
- **`any` without a strong, written reason.** Where `any` is genuinely necessary (an untyped third-party shape, a deliberate escape hatch), it is narrowly scoped, commented with *why*, and never used just to avoid understanding a type.
- **Duplicated business logic.** A rule expressed once — in a SQL helper function, or in a domain's `permissions.ts` / `queries.ts` — is not re-implemented a second time "just for this screen." Two copies of one rule are two chances for them to disagree (the same argument `database.md` §1.3 makes about schema applies to code).
- **Secrets in client code.** No API key, credential, or token is ever inlined into a Client Component, a `NEXT_PUBLIC_*` variable (unless genuinely public by design, e.g. the Supabase anon key), or committed to the repository (architecture §15; Secure Node.js Development rule 4).
- **Service-role keys in browser code.** Zero exceptions. The service-role client is never imported by anything that can end up in the browser bundle (security.md §12, architecture §15) — this single mistake voids every privacy guarantee in the product at once.
- **Disabling RLS.** Never, on any table, for any reason — including "just to debug" or "just for this migration." An apparently-blocking policy means the policy or the query is wrong; fix that, do not turn the guarantee off (security.md §5.1; always-applied workspace rule; CLAUDE.md rule 6).
- **Bypassing authorization to "fix" an error.** An authorization failure is the system working correctly. Widening a policy, adding a service-role call, or removing a membership check to make an error disappear is exactly the failure mode `architecture.md` §21 (ADR-03, ADR-04) and `security.md` §31 exist to prevent (CLAUDE.md rule 6).
- **Giant components.** A component mixing data-fetching, business rules, and a large render tree is split along those seams. If it cannot be summarized in one sentence, it is probably two components.
- **Giant utility files.** A `utils.ts` that accumulates unrelated helpers signals a missing feature boundary; helpers belong in the domain they serve, or in a narrowly named `lib/` module if truly cross-cutting (architecture §16–17).
- **Unrelated refactors during feature tasks.** A phase/feature prompt implements that phase. Renaming, reorganizing, or "improving" unrelated code in the same change is out of scope — raise it separately (CLAUDE.md rule 8; §6 below).
- **Changing architecture without updating docs.** A decision recorded in `architecture.md`, `database.md`, or `security.md` is never silently reinterpreted by code that does something else. If a decision must change, update the document first, with reasoning, then write the code (CLAUDE.md rule 5).
- **Claiming tests passed when they were not run.** Never state or imply a test suite, lint run, type check, or production build succeeded unless it was actually executed in this session and its real output was observed (CLAUDE.md rule 7; §7 and §8 below).
- **A global client-state manager (Redux/Zustand/etc.) for server-owned data.** Server Components plus Server Action revalidation, plus local optimistic state, cover this (architecture §2).
- **Fetching a superset of data and filtering client-side for the current user.** Explicitly banned as an anti-pattern (architecture §11, PRD §20) — it is a performance trick that trades away privacy enforcement.
- Also avoid, per the always-applied Secure Node.js / Secure Python Development rules already in force for this repository: `eval` / `new Function()` / `vm.runInNewContext()` on dynamic or user-controlled input (Secure Node.js rule 2); synchronous `child_process` / shell execution with untrusted input (rule 3); dynamic or user-derived `require()`/`import()` targets (rule 11); mutating native prototypes or relying on global mutation (rule 9); `==`/`!=` in place of `===`/`!==` (rule 10); and SQL built by string concatenation instead of parameters, especially inside privileged database functions (security.md §28).

---

## 4. Code Organization

- **Feature boundaries follow `architecture.md` §16 exactly.** Each domain — `authentication`, `profiles`, `batches`, `memberships`, `invitations`, `memories`, `media`, `comments`, `reactions`, `notifications`, `moderation`, and the reserved post-MVP boundaries (`albums`, `time-capsules`, `yearbook`) — owns its own `actions.ts`, `queries.ts`, `schema.ts`, `types.ts`, `permissions.ts`, and `components/`. A new feature gets this same shape; it is not invented ad hoc.
- **A module owns its data.** Another module reads a domain's data only through that domain's exported query functions — never by writing a fresh query against that domain's tables from outside it (architecture §17).
- **Reusable, domain-agnostic UI lives in `components/`** (`components/ui` for shadcn primitives, `components/motion` for shared animation wrappers). Anything meaningful to only one feature lives in that feature's `components/` instead (architecture §16).
- **Data access is confined to each feature's `queries.ts` / `actions.ts`.** UI components do not compose queries themselves (architecture §6: "frontend components must not own complex database logic"). A page or component calls a feature function; it does not construct a Supabase query inline.
- **Server vs. client component guidance:** default to a Server Component; convert to a Client Component only for interactivity, browser APIs, or animation state, and push that boundary as far from the page root as it will go so the smallest possible subtree becomes client-rendered (architecture §2).
- **Naming conventions:**
  - File names inside a feature are `actions.ts`, `queries.ts`, `schema.ts`, `types.ts`, `permissions.ts` — not `helpers.ts`, `utils.ts`, or an `index.ts` catch-all covering the same content.
  - Server Actions and query functions are named as verbs on a domain noun (`createMemory`, `listBatchMembers`, `approveJoinRequest`), matching the operations `PRD.md` and `security.md` §4/§11 already name.
  - Database identifiers (table, column, enum, constraint names) match `database.md` exactly and are copied from that document, never re-invented at implementation time.
- **Import conventions:**
  - **Dependency direction runs one way**: domain modules may depend on `lib/*` and `components/ui`; `lib/*` never imports from a domain module (architecture §17). A cycle between two domains means the shared concept belongs in one of them, or in `lib`.
  - **No deep imports into another module's internals.** Import a domain's declared public surface (its `actions`, `queries`, `types`, `components` exports) — never reach into another feature's `queries.ts` internals that were not meant to be exported.
  - **`app/` stays thin.** Route files compose feature components and call feature actions; they do not contain business logic (architecture §17).
  - Static imports only — no dynamic or user-derived `require()`/`import()` targets (Secure Node.js rule 11).

---

## 5. Error Handling

- **User-safe errors are generic.** What a user sees never discloses whether a private resource exists, never echoes internal error detail, and is the same shape for "not found" and "not authorized" — a stranger must not be able to distinguish "no such batch" from "that batch exists but you can't see it" (architecture §18.6; security.md §3, "indistinguishable denial").
- **Developer logs carry the detail, correlated, but never the content.** Every error is logged server-side with a request id and, where available, the acting user id and batch id (architecture §14) — but never media bytes, signed URLs, tokens, passwords, comment/caption text, or email addresses (security.md §21). The user-facing message shows a correlation id, never the internals.
- **Server Actions return a discriminated result for expected failures, not a thrown exception.** `{ ok: true, data }` / `{ ok: false, error }` (architecture §18.2). Throwing is reserved for genuinely unexpected failures — "not authorized" and "validation failed" are expected outcomes with a defined shape, not exceptions.
- **Retry states are explicit wherever an operation can fail independently of the user's input** — most importantly the two-step media upload (architecture §8) and invitation redemption (architecture §18.8). Both must be safe to retry: idempotent finalize and idempotent redemption, never silent duplication on a second attempt.
- **Upload failure behavior follows `architecture.md` §8 exactly:**
  - Client-side pre-checks (type/size/duration) are UX affordances only, never enforcement (architecture §8, §10; ADR-08a).
  - A failed direct-to-Storage upload shows progress and supports cancel/retry, and no memory record exists until finalize succeeds.
  - A finalize that fails validation marks the media row `rejected` and deletes the object — the UI must not present a rejected upload as a partial success (`database.md` §3.6).
  - An upload that never reaches finalize is an orphan handled by the scheduled sweep, never by client-side cleanup logic (architecture §13).
- **Destructive-action confirmation scales with blast radius:**
  - Removing a member, or resolving a report: an explicit confirmation step.
  - Deleting a memory or comment: confirmation, and it is a soft delete either way (`database.md` §12).
  - **Ownership transfer and batch deletion are the highest tier** — explicit confirmation naming the target (the batch name, for deletion), with re-authentication before the action proceeds recommended given there is no MFA in MVP (security.md §2, §11, §24, R3). `security.md` names exactly these two actions as irreversible-in-practice.
- Errors surfaced from a privileged RPC (§1.3) reach the UI in the same generic shape as any other authorization failure — the RPC's internal reasoning is a log detail, never a user-facing message.

---

## 6. AI Boundaries

Every future AI coding session working on this repository must:

1. **Implement only the requested phase or prompt.** Read the specific prompt file the user names, and every documentation file it references, before writing anything (CLAUDE.md rules 1–3). Do not start the next numbered prompt in the pack unasked.
2. **Stop when the prompt says stop**, and wait for the next explicit instruction (CLAUDE.md rule 10). "Stop" means stop, not "stop after one more improvement."
3. **Read `docs/memory.md` at the start of a session**, once it exists (from Prompt 10 onward), before making changes — it is the concise handoff of what has already been decided and built.
4. **Update `docs/memory.md` after meaningful work**, once it exists, per CLAUDE.md rule 9 and the update rules `memory.md` itself defines (current phase, completed work, key decisions, known issues, next task). A session that changes real state and leaves `memory.md` stale has broken the handoff for the next session.
5. **Never silently change core architecture.** `project-context.md`, `PRD.md`, `architecture.md`, `database.md`, and `security.md` are the source of truth (CLAUDE.md rule 5). A session that believes one of them is wrong says so and proposes a documented change; it does not just implement something else instead.
6. **Never invent completed tests.** A claim that "tests pass," "the build succeeds," or "lint is clean" is made only after that command actually ran in this session and its real output was read (CLAUDE.md rule 7). If something was not run, say so.
7. **Never add future-phase features "while already here."** Seeing an obvious extension while implementing a narrower task is not a reason to build it now (CLAUDE.md rule 4) — `08_PHASES.md` sequences work deliberately, and `architecture.md` §16 already reserves module boundaries (`albums`, `time-capsules`, `yearbook`, `notifications`) for exactly this reason. Note the boundary; do not fill it early.
8. **Never weaken privacy, authorization, RLS, Storage security, or privileged-RPC rules** to make a task easier or an error disappear (always-applied workspace rule; CLAUDE.md rule 6; security.md §31). This is the one rule in this document with zero exceptions.
9. **Keep changes focused and scoped to what was asked**, resisting drive-by refactors, renames, or reorganizations outside the current task (CLAUDE.md rule 8; §3 above).
10. **Treat this document, and the five it is built from, as binding** unless the user explicitly instructs otherwise in the moment — and even then, name how the instruction departs from documented decisions before proceeding.

---

## 7. Quality Rules

- **Accessibility.** Every core flow named in PRD §19 (signup/login, onboarding, batch creation, join, upload, gallery browsing, memory detail, comments, reactions) is operable by keyboard and screen reader. Interactive elements carry accessible names/labels. Color contrast and type stay legible at shipped sizes. Motion respects `prefers-reduced-motion` (§1.5).
- **Responsive design.** Mobile-first per project-context §9.4 and PRD §10.3: build and test the small-screen layout first, then verify the same flow at larger breakpoints before calling a UI task done.
- **Tests.** The detailed strategy belongs to `docs/testing.md` (created in a later planning step, Prompt 09) — but two rules hold regardless of that document's specifics: (1) the adversarial RLS/Storage tests `security.md` §5.6 requires (non-member, pending requester, rejected requester, removed member, cross-batch, and the column-level forgery attempts in §5.4.1/§5.6) are required for any table or policy that ships, not optional polish; (2) a test is not "passing" unless it was actually executed — see §6 rule 6.
- **Linting.** The project's lint configuration (ESLint, via Next.js's recommended setup) runs clean before work is considered done. A warning is fixed or explicitly justified in the change description — never silently ignored.
- **Type checks.** The TypeScript compiler / Next.js build's type-checking step passes with zero errors under the strict settings in §1.1. Type errors are not suppressed with `@ts-ignore` / `@ts-expect-error` except in a narrowly scoped, commented, genuinely unavoidable case.
- **Production build.** `next build` succeeds before a phase is considered complete. A change that only works under `next dev` is not finished.
- **Documentation.** A change that touches a decision recorded in one of the five source documents updates that document in the same unit of work (CLAUDE.md rules 5, 9). A change that completes meaningful work updates `docs/memory.md` once it exists (§6 above). A durable new convention this document should have covered is proposed as an update to `docs/rules.md` itself, not left undocumented.

---

## 8. The 15 Most Important Rules

1. **RLS is the authorization boundary and is never disabled, weakened, or bypassed** — for any reason, at any time, including "to fix an error" (security.md §31; CLAUDE.md rule 6).
2. **The service-role key never appears in client-reachable code**, never carries a `NEXT_PUBLIC_` prefix, and lives in exactly one server-only, narrowly-audited module (security.md §12).
3. **Never trust the client for identity, role, batch ownership, storage paths, or system timestamps** — the server re-derives all of it from the verified session (security.md §13; architecture §18.4–5).
4. **High-risk writes are RPC-only, never direct client DML**: batch creation, invites, membership decisions, role changes, ownership transfer, media finalize, reports, audit logs, batch deletion (security.md §5.2).
5. **Every Server Action / Route Handler follows authenticate → validate → authorize → execute → revalidate, in that order, with no step skipped** (architecture §18.3).
6. **Implement only the requested phase; stop exactly when told to stop** (CLAUDE.md rules 1–4, 10).
7. **Never claim a test, lint run, type check, or build succeeded unless it was actually run and observed in this session** (CLAUDE.md rule 7).
8. **Never silently change architecture, schema, or security decisions** — update the source document first, with reasoning, or do not do it (CLAUDE.md rule 5).
9. **No secrets, keys, or tokens in client code, logs, or commits, ever** (security.md §12, §21).
10. **A module owns its data; nothing outside a domain writes its own query against that domain's tables** (architecture §17).
11. **`any` is never used without a documented reason; strict TypeScript stays strict** (§1.1, §3).
12. **Keep changes scoped to the task — no unrelated refactors, renames, or "while I'm here" features** (CLAUDE.md rule 8).
13. **Client-side validation and pre-checks (file type, size, duration) are UX only — the server is the sole authoritative check** (architecture §8, §10).
14. **User-facing errors are generic and never reveal whether a private resource exists**; diagnostic detail goes to server logs only, and logs never include content, tokens, or media (security.md §3, §21).
15. **Destructive and irreversible actions (batch deletion, ownership transfer) require explicit, high-friction confirmation** (security.md §11, §24).

---

STOP — Prompt 06 complete. `docs/design.md` is **not** started, no application code, migrations, or SQL files were created, and no packages were installed. Awaiting the next instruction.
