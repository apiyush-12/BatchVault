# BatchVault — Architecture

Status: Draft — MVP architecture
Sources of truth: `/docs/project-context.md`, `/docs/PRD.md`
Prepared per: `/prompts/03_ARCHITECTURE.md`

Guiding rule: the simplest production-quality architecture that supports the MVP. One deployable Next.js application plus Supabase. No microservices. Boring and dependable over clever.

---

## 1. High-Level System Diagram

```
                        ┌─────────────────────────────┐
                        │   Browser (mobile-first)    │
                        │  React Client Components    │
                        │  - UI, animation, forms     │
                        │  - Supabase browser client  │
                        │    (anon key + user session)│
                        └───────────┬─────────────────┘
                                    │ HTTPS
                                    │ (session cookie)
                        ┌───────────▼─────────────────┐
                        │      Vercel (Next.js)       │
                        │                             │
                        │  React Server Components    │
                        │  Server Actions             │
                        │  Route Handlers             │
                        │  Middleware (session)       │
                        │                             │
                        │  Server-side Supabase       │
                        │  client (user-scoped)       │
                        │  + service-role client      │
                        │    (narrow, server-only)    │
                        └───────────┬─────────────────┘
                                    │
              ┌─────────────────────┼──────────────────────┐
              │                     │                      │
   ┌──────────▼────────┐ ┌──────────▼─────────┐ ┌──────────▼─────────┐
   │  Supabase Auth    │ │ Supabase Postgres  │ │  Supabase Storage  │
   │  - email/OTP/     │ │ - all app data     │ │  - private buckets │
   │    OAuth          │ │ - RLS on every     │ │  - storage RLS     │
   │  - issues JWT     │ │   table            │ │  - signed URLs     │
   │                   │ │ - SQL functions    │ │                    │
   └───────────────────┘ └────────────────────┘ └────────────────────┘
              │                     ▲
              │                     │
              └── JWT claims ───────┘
                  (auth.uid() used by RLS)

   Cross-cutting:
   ┌────────────────────┐  ┌───────────────────┐
   │ Vercel Cron        │  │ Error reporting   │
   │ (scheduled jobs)   │  │ (Sentry)          │
   └────────────────────┘  └───────────────────┘

   No BatchVault-owned email provider in MVP. Invitations are shareable
   links (§12); Supabase Auth sends its own authentication emails.
```

Key property: the browser never holds a privileged credential. It holds a user session and the public anon key, and every query it can make is constrained by Row Level Security.

---

## 2. Frontend Architecture

- **Next.js App Router** with React Server Components as the default. A component is a Client Component only when it needs interactivity, browser APIs, or animation state.
- **TypeScript in strict mode.** `strict: true`, `noUncheckedIndexedAccess`, no implicit `any`, no unchecked non-null assertions in application code.
- **Tailwind CSS** for styling; **shadcn/ui** for the base component layer (owned in-repo, not a black-box dependency); **Framer Motion** for transitions and micro-interactions.
- **Mobile-first**: layouts and interaction targets designed for small screens first, then progressively enhanced.
- **Rendering split**:
  - Server Components fetch data (batch gallery, memory detail, member lists) directly from Postgres through a user-scoped Supabase client. No client-side fetch waterfall for initial content.
  - Client Components handle upload UI, comment/reaction interactions, forms, dialogs, and motion.
- **Data mutations** go through Server Actions, never through ad-hoc client-side SQL for anything with business rules.
- **Motion policy**: all Framer Motion usage respects `prefers-reduced-motion` (per PRD §19).
- **No global client state manager for server data.** Server Components plus Server Action revalidation is the default. Local component state (and `useOptimistic` for reactions/comments) covers the rest.

---

## 3. Server-Side Responsibilities

The Next.js server layer owns **application orchestration and business-flow logic** — it is not, however, the only place correctness is enforced. Three layers own distinct things, and collapsing them into "the server owns all business rules" is the mistake this section previously made:

- **Next.js server layer** — orchestration and business flow: sequencing a request, validating input, deciding what operation to invoke, coordinating media steps, revalidating caches.
- **Database constraints and SQL functions** — **atomic invariants**: multi-row operations that must commit together, uniqueness and check constraints, referential/same-batch integrity, and anything that must stay true regardless of which caller wrote it (§6; `database.md` §14).
- **Privileged database functions** — their own **explicit, security-critical authorization checks**, which are the trusted boundary for the writes they perform with rights the caller does not hold (§5 refinement; `security.md` §5.2.2).

The server layer's responsibilities:

1. **Session handling** — read/refresh the Supabase session from cookies on every request (middleware + server client).
2. **Input validation** — validate and parse every Server Action / Route Handler input with a schema validator at the boundary. Never trust client-shaped objects.
3. **Authorization decisions** — check role and membership before performing an action, *in addition to* the database-level RLS guarantee (defense in depth, per PRD §10 and §13).
4. **Domain logic** — invitation issuance and redemption, membership approval, role changes, ownership transfer, moderation actions, memory creation and metadata handling.
5. **Media coordination** — issue scoped upload targets, record media rows after upload, issue signed read URLs.
6. **Revalidation** — invalidate the correct cache tags/paths after a mutation.
7. **Observability** — structured logging and error capture with request/user/batch correlation.

Explicit non-responsibility: the server layer does **not** become a general-purpose API gateway. There is no separate backend service in MVP.

---

## 4. Authentication Flow

Provider: **Supabase Auth**, using the **supported Supabase SSR session and cookie strategy** for Next.js. The session must be readable and refreshable on the server so that Server Components and Server Actions can act as the user. This document does not pin a specific cookie flag set or storage mechanism — the exact cookie attributes and transport are whatever the supported Supabase SSR/browser auth pattern prescribes, and are followed rather than reinvented.

```
1. User submits credentials / magic link / OAuth on a Client Component.
2. Supabase Auth authenticates and issues an access token (JWT) + refresh token.
3. The session is persisted as cookies by the supported Supabase SSR client,
   using that library's own cookie handling.
4. Next.js middleware refreshes the session on request and writes back the
   updated cookies.
5. Server Components / Server Actions construct a request-scoped Supabase client
   bound to those cookies. Every query they issue runs as that user.
6. Postgres RLS policies evaluate auth.uid() from the JWT.
7. Sign-out clears the session cookies and revokes the refresh token.
```

Rules:
- Auth state used for authorization decisions must be read **server-side** from the verified session, never from a client-supplied user id.
- **The session is an identity mechanism, not an authorization mechanism.** Regardless of how the cookie is stored or which parts of it are reachable from client code, authorization is decided server-side (§5 Layer 2) and guaranteed by RLS (§5 Layer 3). Possession of a session grants only the access that RLS permits for that user.
- Protected route groups are guarded server-side (redirect to sign-in), not by hiding UI.
- Post-signup, users are routed through profile onboarding (PRD §9.2) before they can create or join a batch.

---

## 5. Authorization Flow

Three layers, all required. The database layer is the guarantee; the others are ergonomics and defense in depth.

```
Layer 1 — UI (convenience only)
   Hide/disable actions the user cannot perform.
   NEVER the sole enforcement point.

Layer 2 — Server Action / Route Handler (explicit checks)
   Resolve the caller's membership + role for the target batch.
   Assert the required capability before mutating.
   Fail closed with a generic error; do not leak existence of private resources.

Layer 3 — PostgreSQL Row Level Security (the guarantee)
   Every table has RLS enabled. Policies derive access from the caller's
   membership in the batch that owns the row. A user with no approved
   membership can select nothing from that batch — even if Layers 1 and 2
   have a bug.
```

**Refinement (added by the Prompt 11 audit; `security.md` §3 and §5.2.2 are authoritative).** Layer 3 has **two forms**, and conflating them is a mistake:

- **Direct table access** — RLS is the boundary, *plus* column-level enforcement where a table is directly writable (`security.md` §5.4.1). A row policy alone never decides *which fields* a caller may control.
- **Storage access** — **Storage RLS** is the boundary for media, and it must reflect the database's visibility state, not membership alone (`security.md` §7.1).
- **Privileged database functions** that execute with rights the caller does not hold — there, RLS is *not* what authorizes the write; **the function's own explicit database-side authorization logic is the trusted boundary** for that operation (`security.md` §5.2.2).

RLS remains enabled and `FORCE ROW LEVEL SECURITY` on every table regardless. Do not restate Layer 3 as the oversimplified absolute "RLS alone authorizes everything."

Role model (PRD §12): Batch Owner > Batch Admin > Moderator > Member > (future) Guest/Public Viewer.

Authorization principles:
- **Membership-derived, not user-derived.** Access to a row is a function of the caller's approved membership in the row's batch, plus role for privileged actions.
- **Pending memberships are not access.** An unapproved join request grants no read access to batch content.
- **Removal is immediate.** Losing membership immediately removes read access at the policy level; no cached authorization is trusted across a mutation.
- **No self-escalation.** Role changes are only performable by roles authorized to grant them, enforced in both Layer 2 and Layer 3.
- **Private by default.** New tables start with RLS enabled and no permissive policy; access is added deliberately.
- Privileged role-resolution logic lives in SQL helper functions (e.g. "is the caller an approved member of batch X", "does the caller hold at least role R in batch X") so policies stay short, consistent, and reviewable, and so the same predicate is not re-implemented per table.

Detailed policy design is **out of scope for this document** and belongs to the database design step.

---

## 6. Database Access Approach

*(Access strategy only — no schema, tables, or columns are defined here. That is the database design step.)*

- **Single PostgreSQL database** (Supabase). No separate read store, no ORM-managed second source of truth.
- **Two client types, strictly separated:**
  | Client | Key | Where it may run | Purpose |
  |---|---|---|---|
  | User-scoped client | anon key + user session | browser and server | All normal reads/writes; fully RLS-constrained |
  | Service-role client | service role key | **server-only modules** | Narrow, audited operations that must bypass RLS |
- The service-role client lives in a module marked server-only and is imported by a deliberately small number of call sites. Every use requires an explicit reason. It is never imported into a Client Component, never referenced in code reachable from the browser bundle, and its key is never exposed as a `NEXT_PUBLIC_*` variable.
- **Data access is confined to a per-feature data layer.** UI components do not compose queries. Each feature module exposes typed functions (e.g. "list memories for batch", "create comment") and those functions are the only place query construction happens (rule: frontend components must not own complex database logic).
- **Typed end-to-end.** Database types are generated from the schema and imported by the data layer, so drift between schema and code surfaces at compile time.
- **Multi-row invariants live in SQL.** Operations that must be atomic (e.g. redeem invitation + create membership, transfer ownership) are implemented as database functions invoked via RPC rather than as multiple round-trips from application code.
- **Direct client-side reads are allowed only for simple, RLS-safe cases** where the query carries no business logic. Anything with rules goes through the server.

---

## 7. Storage Architecture

Supabase Storage for MVP (per project-context §10).

- **Private buckets only.** No public bucket holds batch media. There is no MVP path by which an unauthenticated URL exposes batch content.
- **Bucket layout** — separated by content class so policies and lifecycle differ cleanly:
  - a bucket for batch memory media (photos, videos, and their derivatives),
  - a bucket for profile/avatar images,
  - (future) a bucket for explicitly published showcase content, which is the *only* one that could ever become public.
- **Object paths are server-generated, and their shape differs by bucket** — not every path is batch-scoped (`security.md` §6):
  - **Batch media** — `{batch_id}/{media_asset_id}`. Batch-scoped, so Storage RLS can derive the batch from the path the same way table policies derive it from a foreign key (see §8).
  - **Avatars** — `{profile_id}/{asset_id}`. **Profile-scoped**, with no batch id in the path at all; avatar authorization is therefore decided by profile visibility rules, not by the batch-media predicate (`security.md` §6.1).
  - Path parsing fails closed: a malformed name, a missing segment, or a segment that is not a UUID denies access rather than falling through to a permissive branch.
- **The client never chooses, supplies, or influences an object path.** Paths are composed entirely server-side from the authenticated caller's batch context and a server-generated identifier. Original filenames are treated as untrusted display metadata stored in the database, never as path components.
- **Storage RLS mirrors table RLS.** A user may read an object only if they hold an approved membership in the batch that owns the path; upload is likewise membership-gated.
- **Reads are normally served via signed URLs** that the application mints with a short TTL per request for the current viewer. Signed URLs are never persisted in the database, logged, or shared across users. **This is not server-only minting**: creating a signed URL requires the same Storage `SELECT` permission an ordinary read requires, so an authenticated member who already satisfies the Storage RLS policy for an object may call the signed-URL API directly and choose their own expiry. That is the adopted **Option B** model — it is not a privacy bypass (they already had that read access), but the application's TTL and rate limits bound only the URLs the application mints (`security.md` §8, §8.1).
- **The database is authoritative for metadata**; Storage holds bytes only. An orphaned object is recoverable; an orphaned metadata row is not authoritative content.

---

## 8. Media Upload Flow

Direct-to-Storage upload. Media bytes never proxy through the Next.js server (avoids serverless request body limits and keeps functions fast).

```
1. Client selects file(s). Client-side pre-checks: MIME type, size, and — for
   video — duration. These are UX guards only (see §10).

2. Client calls a Server Action: "request upload for batch B".
   Server: verifies session → verifies approved membership in B →
   validates declared content type/size against policy →
   GENERATES a stable identifier for this upload →
   composes the object path from (batch id + that identifier) →
   returns a scoped upload target (signed upload URL / token) bound to
   that exact path. The client never chooses or supplies the path.

3. Client uploads bytes directly to Supabase Storage using that target,
   showing progress and supporting cancel/retry.

4. Client calls a Server Action: "finalize memory", referencing the
   identifier from step 2 (not a path).
   Server: **(Phase 4A, B1-resolved exception to "bytes never proxy
   through the server" — the one deliberate exception, bounded by the
   same size cap already enforced below)** for a JPEG object, downloads
   the uploaded bytes, strips the EXIF `APP1` segment (GPS/location) with
   no re-encode, and re-uploads the result to the same server-issued path
   (overwrite of the caller's own still-`pending` object, the same
   permission the original upload already required — security.md §6.2).
   Other allowed image types pass through unmodified this phase
   (security.md §27 B1). Then: re-verifies membership → confirms the
   object exists at the path it issued → enforces actual object size and
   content type against policy, read from Storage's own object metadata →
   writes the memory + media metadata (caption, event name, date, uploader)
   in one transaction. A rejection deletes the object via the Storage API
   (not a bare SQL `DELETE` on `storage.objects`, which would orphan the
   backing bytes) before the row is removed.

5. Server revalidates the batch gallery cache tag. Memory appears.
```

**Path identifier (step 2).** The path is keyed by a **server-generated UUID** — either a preallocated memory id or a separate upload/media id — created before any bytes exist. This is what makes the path unguessable by the client, stable across retries, and derivable back to a batch for Storage RLS. Which of the two identifiers is used, and how it relates to the memory record, is a **database design decision and is deliberately left open here**; the architectural requirement is only that it is server-generated, opaque, and allocated before the upload target is issued.

Failure handling:
- Steps 3 and 4 can fail independently. An uploaded object with no finalize call is an orphan; a scheduled sweep (§13) removes orphans older than a grace window.
- Finalize is idempotent per upload identifier, so a retried finalize does not create duplicate memories.
- **Step 1 is never trusted.** Client-declared type, size, and duration are UX affordances only.
- **What step 4 can and cannot prove.** The server authoritatively enforces *object existence, actual stored size, and content type* — these are properties Storage itself reports. It does **not** prove intrinsic media properties such as video duration, codec, or frame dimensions; those live inside the file's bytes and are not established by object metadata (see §10).

---

## 9. Image Thumbnail / Optimization Approach

The gallery is the product's core surface (PRD §9.13) and is mobile-first, so it must never download full-resolution originals.

MVP approach:
- **Originals are preserved unmodified**, with one narrow, named exception (security.md §27 B1, resolved): a JPEG's EXIF `APP1` segment is stripped at finalize, at the byte-segment level with no re-encode, before the object is ever accepted as "the" stored original — there is no separate unstripped predecessor retained. No other processing mutates the original, and no derivative overwrites it.
- **Derivatives — RESOLVED (Q4, database.md): option (a), Supabase Storage image transformations** — requested by URL parameter on the same signed URL. No pipeline to own, no `media_assets` schema change. The paid-plan dependency this carries is an accepted cost.
- **`next/image`** handles responsive `sizes`, lazy loading, and modern formats where used elsewhere in the app, but **batch media specifically skips the Next.js image optimizer (R2, resolved)**: the optimizer keys its cache on URL and signed URLs rotate, so it is a poor fit, and introducing an application media route to work around it would be a new authorization surface this phase does not need. Batch media renders via `next/image unoptimized` (or a plain `<img>`) pointed at a short-lived (15-minute, R1) signed URL carrying the Storage transformation parameters directly.
- **Blur/placeholder**: a tiny placeholder is derived at finalize time and stored in metadata, so the gallery has no layout shift and feels instant on mobile.
- Explicit anti-goal: no image processing on the client as the authoritative step, and no processing that mutates the original.

---

## 10. Video Upload Constraints for MVP

MVP supports **short videos** (PRD §9.10) and deliberately does **no transcoding**. Constraints exist so this remains true:

- **Accepted container/codec**: MP4 with H.264 video and AAC audio — the combination that plays natively across current mobile and desktop browsers without a transcode step.
- **Hard size cap** and **hard duration cap** (short-form only). Exact numbers are a product/ops decision; the architecture requires that both caps exist. How strongly each is *enforced* differs, and the difference is deliberate — see the validation model below.
- **No server-side transcoding, no adaptive bitrate, no HLS/DASH packaging** in MVP. Playback is progressive download of the stored file via a signed URL.

### Validation model — what is actually enforceable in MVP

A correction to a tempting but false assumption: **Supabase object metadata does not prove a video's duration or codec.** Stored size and reported content type are properties of the object; duration, codec, profile, and dimensions are properties of the *bytes inside* the file. Reading them requires actually inspecting the media. The MVP therefore has two tiers of validation, and the document is explicit about which is which:

| Property | MVP enforcement | Strength |
|---|---|---|
| File size | Server-side at finalize, from actual stored object size | **Authoritative** |
| MIME / content type | Server-side at finalize, against an allowlist | **Server-observed metadata, enforced against the allowlist** — authoritative as *the type Storage reports for the stored object*, and **not** intrinsic proof of what the bytes contain |
| Object exists at the issued path | Server-side at finalize | **Authoritative** |
| Video duration | Client-side pre-check only | **UX validation only — not a guarantee** |
| Codec / container internals | Client-side pre-check only | **UX validation only — not a guarantee** |

- **Server-side validation at finalize authoritatively enforces the allowed MIME/content type and the file-size limit.** These are the MVP's real, enforced constraints, and they are the ones the size cap depends on.
- **Client-side duration and codec checks are UX validation only.** They catch honest mistakes and give immediate feedback; they are trivially bypassable and must never be described or relied upon as enforcement.
- **A content type allowlist is not a codec guarantee.** A file may be accepted as `video/mp4` and still contain a codec the browser will not play. In MVP the consequence is a playback failure for that one memory, not a security or integrity problem — an acceptable trade at this scope, and the size cap still bounds the blast radius.
- **If authoritative duration/codec enforcement is later required**, it needs a **trusted media-inspection step** — `ffprobe` or equivalent media processing running in a trusted server or background environment (a post-upload inspection job, or a media-processing service invoked behind the `media` module boundary). This is real added infrastructure, and it is **not** in the MVP. Adding it would not require changing the upload flow's shape: it slots in as an inspection step after finalize that can flag or quarantine a memory whose bytes violate policy.
- Practical consequence to accept knowingly: in MVP, the duration cap is a **soft, best-effort limit** backed by a hard size cap. Since size and duration correlate for a given quality level, the size cap is the constraint that actually bounds storage and bandwidth. This is stated plainly rather than papered over.
- **Poster frame**: captured client-side at upload where the browser permits, uploaded as a companion image. If capture fails, the memory renders with a neutral placeholder rather than blocking the upload.
- **No live streaming, ever** — explicitly excluded by the PRD.
- Migration path if these constraints prove too tight: introduce an external transcoding/streaming provider behind the media module boundary (§17), without changing callers. That path is deliberately not built now.

---

## 11. Caching Strategy

The dominant rule: **private batch content must never be cached in a shared or public cache.**

- **Authenticated pages are dynamic.** Any route that reads the session is rendered per request. No full-route static caching, no shared CDN caching of private HTML. `Cache-Control: private, no-store` on responses carrying batch content.
- **Server-side data caching is per-user-scoped and tag-invalidated.** Where a request-level or short-lived cache is used to avoid duplicate queries within a render, its key includes the acting user. A cache entry is never reusable across users.
- **Cache tags per resource** — e.g. a tag for a batch's gallery, one for a specific memory. Server Actions revalidate exactly the tags they invalidate (post a comment → revalidate that memory; create a memory → revalidate that batch's gallery).
- **Signed media URLs are not cached beyond their TTL** and are not stored in any shared cache layer.
- **Static assets** (JS, CSS, fonts, icons) use normal immutable CDN caching — these contain no user data.
- **Client-side**: optimistic UI for reactions and comments; router cache invalidated on mutation. No long-lived client cache of batch content that would survive a membership removal.
- Anti-pattern explicitly banned: fetching a superset of data and filtering it for the current user in the client for speed (PRD §20).

---

## 12. Notifications Architecture

The PRD does not list notifications as an MVP functional requirement, so the MVP posture is deliberately minimal — but the boundary is defined now so that adding them later does not require rework.

- **Invitations are delivered by the user, not by the system.** The primary — and for MVP the only required — invitation mechanism is a **secure invite link/code** generated server-side and handed to the inviter to copy and share through whatever channel their batch already uses: WhatsApp, a QR code, SMS, any messaging app. This matches how a college batch actually coordinates, and it means **the MVP does not depend on a dedicated transactional email provider at all**.
- **No dedicated invitation email provider is required for MVP.** Sending invitation emails from BatchVault is an optional, future enhancement. If added later, it is delivery of the same invite link through one more channel — it changes nothing about how invitations are issued, authorized, or redeemed, and it lives behind the notifications module.
- **Supabase Auth may still send email** for authentication flows it owns (magic link, verification, password reset). That is Supabase's built-in email, is part of the auth provider, and is separate from any BatchVault-owned notification delivery.
- **Invite link security properties** (issuance and redemption remain owned by the `invitations` module): the token is a high-entropy, server-generated, unguessable value; it is scoped to a single batch; it **supports** expiry — `expires_at` is nullable, so expiry is controllable rather than structurally mandatory, and a finite default remains a **security recommendation pending the relevant product decision** (`database.md` §3.4; `security.md` §9), with §13's sweep retiring links that do carry one; it is revocable by Owner/Admin; and **redeeming it grants only what the batch's settings allow** — where the batch requires approval, redemption creates a pending membership, not access (PRD §9.8, §5 "pending memberships are not access"). A shareable link is explicitly *not* a bypass of the privacy model.
- **In-app notifications are modeled as a module boundary, not built.** A `notifications` feature module exists in the structure (§16) and owns any future notification records, preferences, and delivery. Other modules emit domain events to it; they never talk to an email provider directly.
- **No push notifications, no notification feed, no digest emails in MVP.** These are postponed (§22).
- **No real-time subscriptions in MVP.** Supabase Realtime is a natural future fit for live comments/reactions, but it introduces a second authorization surface (channel-level access) and is not required for a preservation-oriented product. Postponed.
- Design constraint for anything added later: a notification must never leak private batch content to a non-member — notification payloads carry references, and content is resolved at view time behind the normal authorization checks.

---

## 13. Background Jobs / Asynchronous Processing

No queue, no worker service, no message broker in MVP. Two mechanisms only:

1. **Vercel Cron → protected Route Handlers.** Scheduled endpoints under a dedicated route segment, authenticated by a shared secret and rejecting any unauthenticated caller. Initial jobs:
   - **Orphaned upload sweep** — delete Storage objects with no finalized memory row after a grace window (§8).
   - **Expired invitation cleanup** — retire invitations past their validity window.
   - **Soft-delete reaping** — permanently remove content past its retention window, once that policy is decided (PRD unresolved decision #5).
2. **In-database work** — constraints, triggers, and SQL functions handle invariants that must hold atomically with the write (counters, timestamps, cascade behavior). Preferred over application-level orchestration.

Rules:
- Cron jobs are **idempotent** and safe to run twice; they operate in bounded batches so a single invocation cannot exceed the function timeout.
- Cron handlers use the service-role client (they act as the system, not a user) and are among the small number of audited service-role call sites.
- Anything that must happen *before* the user sees a result happens inline in the Server Action, not in a job. Jobs are for cleanup and deferred work only.

Future-unlock time capsules (post-MVP) are anticipated to be **visibility predicates evaluated at read time**, not jobs that flip a flag — a row is invisible until its unlock timestamp passes, enforced in RLS. This avoids a scheduler being a correctness dependency for a privacy guarantee.

---

## 14. Logging and Error Reporting

- **Structured server-side logging** (JSON) from Server Actions, Route Handlers, and cron jobs. Every log line carries a request id, and where applicable the acting user id and batch id, so an incident can be traced across layers.
- **Error reporting via Sentry** (or equivalent) for both server and client, with source maps uploaded at build time and release tagging tied to the deployment.
- **Privacy in telemetry is a hard rule.** Never log: media bytes, signed URLs, access/refresh tokens, service-role key, comment or caption text, or email addresses in message bodies. Log identifiers, not content. A user's memories must not be reconstructable from logs.
- **User-facing errors are generic**; diagnostic detail goes to the log with a correlation id shown to the user. Authorization failures in particular do not disclose whether a private resource exists.
- **Audit trail for privileged actions** — role changes, member removals, moderation removals, and ownership transfer are recorded as durable records in the database (not just logs), because they are contested actions with a moderation story (PRD §17).
- Vercel platform logs cover runtime/infra; application-level events are not left to platform logs alone.

---

## 15. Environment Variable Strategy

- **Two tiers, enforced by naming.** Only variables prefixed `NEXT_PUBLIC_` are inlined into the browser bundle. Everything else is server-only. The Supabase URL and anon key are public by design; the **service role key is server-only and must never carry the public prefix** — this is a review checklist item, not a convention.
- **Validated at startup.** A single typed environment module parses and validates all variables with a schema at boot, splitting server and client schemas so a server-only secret cannot be read from client code. Missing or malformed configuration fails the build/boot loudly rather than at first use.
- **Access only through that module.** Application code never reads `process.env` directly, so every variable has one declaration site and one type.
- **Per-environment isolation** — separate Supabase projects (and therefore separate databases, storage, and keys) for local, preview, and production. Preview deployments never point at the production database.
- **Secrets live in the platform** (Vercel project settings) and in a local, git-ignored env file. A committed `.env.example` documents required names with no values.
- **Rotation is assumed.** No secret is embedded in a client bundle or in a stored URL, so any key can be rotated without invalidating stored data.

---

## 16. Folder and File Structure

Feature-oriented, not layer-oriented. Domains own their data access, logic, and UI.

```
/
├─ app/                              # Next.js App Router — routing & composition only
│  ├─ (marketing)/                   # public, unauthenticated surface
│  ├─ (auth)/                        # sign in / sign up / callback
│  ├─ (onboarding)/                  # profile onboarding
│  ├─ (app)/                         # authenticated surface
│  │  ├─ batches/
│  │  │  └─ [batchId]/
│  │  │     ├─ page.tsx              # batch gallery
│  │  │     ├─ memories/[memoryId]/  # memory detail
│  │  │     ├─ members/
│  │  │     ├─ moderation/
│  │  │     └─ settings/
│  │  └─ invite/                     # NO token in the path — the raw token
│  │                                  # travels in the URL fragment and is
│  │                                  # submitted in the redemption POST body
│  │                                  # (security.md §9.1)
│  ├─ api/                           # Route Handlers (webhooks, cron, media routes)
│  │  ├─ cron/
│  │  └─ media/
│  └─ layout.tsx
│
├─ features/                         # domain modules — the real code lives here
│  ├─ authentication/
│  ├─ profiles/
│  ├─ batches/
│  ├─ memberships/
│  ├─ invitations/
│  ├─ memories/
│  ├─ media/
│  ├─ albums/                        # post-MVP; boundary reserved
│  ├─ comments/
│  ├─ reactions/
│  ├─ notifications/
│  ├─ moderation/
│  ├─ time-capsules/                 # post-MVP; boundary reserved
│  └─ yearbook/                      # post-MVP; boundary reserved
│
├─ components/                       # shared, domain-agnostic UI
│  ├─ ui/                            # shadcn/ui primitives
│  └─ motion/                        # shared Framer Motion wrappers
│
├─ lib/                              # cross-cutting infrastructure
│  ├─ supabase/                      # browser / server / service-role clients
│  ├─ auth/                          # session helpers
│  ├─ authz/                         # capability + role helpers
│  ├─ env/                           # validated environment module
│  ├─ logging/
│  └─ validation/
│
├─ types/                            # generated database types, shared types
├─ supabase/                         # local Supabase config; migrations added later
├─ public/
└─ docs/
```

Each `features/<domain>/` follows the same internal shape:

```
features/memories/
├─ actions.ts        # Server Actions — the module's write surface
├─ queries.ts        # server-side reads (data layer; only place queries are built)
├─ schema.ts         # input validation schemas
├─ types.ts          # domain types
├─ permissions.ts    # capability checks for this domain
└─ components/       # domain UI (server + client components)
```

Modules for post-MVP domains exist as directory boundaries only. **They are not implemented in the MVP** — they are listed so that when those features arrive they land in an already-correct place rather than forcing a restructure.

---

## 17. Feature/Module Boundaries

Rules that keep the modular structure real rather than decorative:

- **A module owns its data.** Another module reads a domain's data through that domain's exported query functions, not by writing its own query against the domain's tables.
- **Public surface is explicit.** Each module exposes a deliberate set of exports (actions, queries, components, types). Deep imports into a module's internals are not allowed.
- **Dependency direction runs one way.** Domain modules may depend on `lib/*` and `components/ui`; `lib/*` never depends on a domain module. Cycles between domains are a design error — if two domains need each other, the shared concept belongs in one of them or in `lib`.
- **`app/` is thin.** Route files compose feature components and call feature actions. Business logic in `app/` is a smell.
- **`media` is the only module that talks to Storage.** Everything else asks `media` for an upload target or a display URL. This is what makes §10's migration path (external transcoding provider) a contained change.
- **`authz` is the only place role hierarchy is expressed** in application code, mirroring the SQL helper functions. Role comparison logic is not re-implemented per feature.
- **`notifications` is the only module that talks to an email/delivery provider.**
- **Cross-cutting privacy rule**: every module that reads batch-scoped data assumes RLS is active and does not attempt to reproduce its filtering in application code as the primary guard.

---

## 18. API/Server-Action Conventions

**Default: Server Actions.** Route Handlers only where a Server Action cannot work.

Use a Route Handler for: cron endpoints, third-party webhooks, and any media route that must stream bytes or set custom headers. Everything user-initiated is a Server Action.

Conventions for every Server Action:

1. Marked `"use server"`, defined in the owning module's `actions.ts`, never inline in a component file.
2. **Signature is the contract**: accepts a validated input shape, returns a discriminated result (`{ ok: true, data }` | `{ ok: false, error }`). Actions do not throw as a control-flow mechanism for expected failures.
3. **Order of operations is fixed and non-negotiable:**
   ```
   authenticate  →  validate input  →  authorize (membership + role)
                 →  execute (data layer / RPC)  →  revalidate  →  return
   ```
4. **Never accept a caller-supplied user identity.** The acting user comes from the verified session only.
5. **Never accept a caller-supplied storage path, role string, or batch-ownership claim** without re-deriving or re-verifying it server-side.
6. **Errors are generic to the caller**, detailed to the log. Authorization failures return the same shape as not-found, so a non-member cannot probe for the existence of a private batch or memory.
7. **Mutations revalidate explicitly** — the action names the tags/paths it invalidated (§11).
8. **Idempotency where retries are plausible** — notably media finalize and invitation redemption.
9. Route Handlers follow the same order of operations, plus: cron routes verify the shared secret before anything else, and webhook routes verify the provider signature before parsing the body.

---

## 19. Future Scale Path

The MVP is a single Next.js app plus Supabase and is expected to remain adequate well past launch. Escalation, in the order it would actually be needed:

1. **Index and query tuning** on the gallery read path — the first thing that hurts, and the cheapest fix.
2. **Pagination hardening** — keyset/cursor pagination for large batch archives (PRD §20 already requires incremental loading).
3. **Media delivery** — move media reads behind a CDN with per-viewer authorization at the edge if signed-URL minting becomes a hot path.
4. **Derivative pipeline** — if on-demand transformation becomes a cost or latency problem, move to precomputed derivatives generated asynchronously.
5. **Read replicas** for heavy read traffic, once the read path is genuinely dominant.
6. **Real transcoding / streaming provider** behind the `media` boundary, if video needs outgrow §10.
7. **A real job queue** if background work grows past what idempotent cron sweeps handle.
8. **Object storage migration** — Storage access is confined to the `media` module specifically so the underlying provider can change (project-context §10 says Supabase Storage "initially") without touching feature code.

Explicitly *not* on the path: splitting into microservices. Growth is absorbed by tuning the read path, moving media delivery, and adding async capacity — not by decomposing a single-team application into services.

---

## 20. Backup and Recovery Considerations

Preservation is the product's core promise (project-context §7, §12; PRD §18), so backup is a product requirement, not an ops afterthought.

- **Database**: rely on Supabase's managed automated backups and point-in-time recovery, with the plan tier chosen deliberately to provide a recovery window appropriate to a preservation product. Backup coverage is a purchasing decision, not a default.
- **Independent export**: managed backups alone are a single-vendor dependency. A periodic export of the database and media inventory to storage outside the primary provider is a preservation requirement, not an optimization. Scope and cadence are an ops decision; the requirement is that vendor loss is survivable.
- **Storage objects**: Supabase Storage is not automatically covered by database backups. Media durability must be verified and treated as a distinct concern from database durability.
- **Deletion is soft by default** for user-visible content, with a retention window before permanent removal (§13), so an accidental removal is recoverable. Batch deletion in particular is high-friction and grace-perioded (PRD §18) — the architecture supports it, the exact window is an unresolved product decision.
- **Restores must be rehearsed.** An untested backup is not a backup; restore drills belong in the operational cadence before the product carries irreplaceable data.
- **Data portability is designed in**: no proprietary encoding of media or metadata, so a full-batch export remains feasible when it is built post-MVP.

---

## 21. Architecture Decision Records / Important Decisions

| # | Decision | Rationale | Consequence |
|---|---|---|---|
| ADR-01 | Single Next.js application on Vercel; no microservices | One small team, one product, MVP scope. Service boundaries would add operational cost with no benefit at this size | All server logic lives in one deployable; scaling is vertical/tuning-first (§19) |
| ADR-02 | Supabase (Auth + Postgres + Storage) as the single backend platform | Removes the need to build auth, storage, and a database layer separately; RLS gives database-level privacy enforcement | Vendor concentration — mitigated by module boundaries (§17) and independent export (§20) |
| ADR-03 | The **database** is the authoritative authorization boundary — RLS for direct table access (plus column-level enforcement), Storage RLS for media, and a privileged function's own explicit checks for the writes it performs with rights the caller lacks (§5 refinement; `security.md` §3, §5.2.2, §7.1) | PRD §10/§11 require privacy enforcement below the application layer; a UI or action bug must not become a data leak | Every table needs policies; policy design becomes the highest-risk work item, and each privileged function is trusted security code reviewed as such |
| ADR-04 | Defense in depth: authorize in Server Actions *and* in RLS | RLS alone gives correct-but-opaque failures; explicit checks give good errors and catch mistakes earlier | Duplicate expression of rules — mitigated by a single `authz` module mirroring SQL helper functions |
| ADR-05 | Server Actions as the default write surface; Route Handlers only for cron/webhooks/media streaming | Fewer moving parts than a parallel REST layer; type-safe end to end | Conventions (§18) must be enforced by review, since Server Actions are easy to write carelessly |
| ADR-06 | Private Storage buckets with short-lived signed URLs | A public bucket URL is an unauthenticated leak path and is incompatible with §11 | Signed-URL minting is on the read path; interacts awkwardly with image optimization (§9) |
| ADR-07 | Direct browser-to-Storage upload, server-issued targets | Avoids serverless body limits; keeps functions fast; server still controls path and authorization | Two-step upload with an orphan window, handled by finalize + sweep (§8, §13) |
| ADR-08 | No video transcoding in MVP; constrained accepted formats instead | Transcoding is the single largest infrastructure cost/complexity jump; short videos do not require it | Some user uploads will be rejected; migration path reserved behind the `media` boundary |
| ADR-08a | MVP enforces media **type and size** server-side; duration/codec are client-side UX checks only | Object metadata cannot prove intrinsic media properties; authoritative checks require `ffprobe`-class inspection, which is real added infrastructure | The duration cap is soft in MVP, bounded in practice by the hard size cap; a trusted inspection step can be added post-finalize later without reshaping the upload flow (§10) |
| ADR-08b | Invitations ship as secure, shareable invite links/codes, not system-sent emails | Matches how batches actually coordinate (WhatsApp/QR/messaging) and removes a transactional email provider from the MVP critical path | Redemption still honors batch approval settings — a link is never a privacy bypass; BatchVault-sent invite email remains optional/future (§12) |
| ADR-09 | Service-role key confined to server-only modules with audited call sites | An exposed service-role key bypasses every privacy guarantee in the product | Requires review discipline; enforced by naming rules and env validation (§15) |
| ADR-10 | Feature-oriented folder structure, including reserved post-MVP module boundaries | Keeps domains modular; lets time capsules/yearbook/albums land without restructuring | Some directories exist as boundaries before they hold implementation |
| ADR-11 | Time-capsule unlocking modeled as a read-time visibility predicate, not a scheduled flag flip | A scheduler must not be a correctness dependency for a privacy guarantee | Post-MVP, but constrains how that data is modeled — recorded now so the database step accounts for it |
| ADR-12 | Public/showcase content isolated to its own future bucket and explicit publication path | project-context §11 requires that a future opt-in showcase never accidentally expose private content | Publication will be an explicit copy/mark operation, never a permission relaxation on private storage |

---

## 22. Things Intentionally Postponed

Not in the MVP architecture, by decision:

- Real-time subscriptions (live comments/reactions) — second authorization surface, not required for a preservation product.
- Push notifications, in-app notification feed, digest emails — MVP relies on shareable invite links plus Supabase Auth's own email; no BatchVault-owned email delivery (§12).
- BatchVault-sent invitation emails and a dedicated transactional email provider — optional/future, since invitations ship as shareable links (§12).
- Video transcoding, adaptive bitrate, HLS/DASH, thumbnails-from-video server-side (§10).
- Authoritative media inspection (`ffprobe`-class duration/codec verification in a trusted environment) — MVP enforces type and size only (§10).
- Full-text/semantic search across a batch archive (PRD §15).
- Albums / curated collections beyond chronological and event grouping (PRD §15).
- Time capsules and yearbook features — boundaries reserved (§16), behavior constrained (ADR-11), not built.
- The opt-in public showcase — architecture must not preclude it (ADR-12), MVP must not implement it.
- Full data-export tooling — portability designed in (§20), export UX is post-MVP (PRD §15/§18).
- A job queue, worker service, or message broker (§13).
- Read replicas, sharding, multi-region (§19).
- Multi-tenant admin/back-office tooling beyond per-batch moderation.
- Any form of facial recognition, direct messaging, follower graph, reels feed, marketplace, dating, crypto/blockchain, or live streaming — permanently excluded by the PRD, not merely deferred.

---

## Architecture Summary

BatchVault MVP is one Next.js (App Router, strict TypeScript) application on Vercel, backed by Supabase for Auth, PostgreSQL, and Storage. Server Components read data through a request-scoped, user-bound Supabase client; Server Actions perform all writes behind a fixed authenticate → validate → authorize → execute → revalidate sequence. Authorization is layered — hidden in the UI, checked in the action, and **guaranteed at the database boundary**, which takes three forms (§5 refinement): **direct table access** is authorized by PostgreSQL RLS plus column-level enforcement; **Storage access** is authorized by Storage RLS; and a **privileged database function** executing with rights the caller lacks is authorized by the function's own explicit authorization logic. An application bug therefore cannot become a privacy breach. Media is uploaded directly from the browser to private Storage buckets using server-issued, membership-checked upload targets, then finalized server-side; reads are normally served through short-lived application-minted signed URLs, with the Option B caveat in §7 that an already-authorized member can also mint their own. Code is organized by domain (batches, memberships, invitations, memories, media, comments, reactions, moderation, and reserved post-MVP boundaries), with all query construction confined to each domain's data layer and the service-role credential confined to a few audited server-only call sites. Background work is limited to idempotent Vercel Cron sweeps; there is no queue, no worker service, and no microservices.

## Five Highest-Risk Architecture Areas

1. **RLS policy correctness.** RLS is the privacy guarantee for direct table access (ADR-03, as refined in §5 — privileged functions carry their own boundary), and policy bugs fail silently — an over-permissive policy leaks a batch's archive with no error anywhere. This needs dedicated adversarial testing (a non-member attempting every read path), not incidental coverage. It is the single highest-risk area in the product.

2. **Service-role credential containment.** One accidental `NEXT_PUBLIC_` prefix, one import of the service-role client into a module reachable from the browser bundle, and every privacy guarantee is void at once. The blast radius is total and the mistake is a one-character kind of error.

3. **Private media delivery vs. image optimization.** Short-lived signed URLs and URL-keyed image caching are in genuine tension (§9). Getting this wrong produces either a performance failure on the gallery — the product's core surface on mobile — or, worse, a cached/shared media URL that outlives the viewer's authorization.

4. **The two-step upload's consistency window.** Upload and finalize can fail independently (§8), producing orphaned objects, duplicate memories on retry, or memories whose media is missing. Idempotent finalize and the orphan sweep are the mitigations, and both are easy to under-implement because the happy path always looks fine.

5. **Preservation durability across two systems.** The product promises a 20-year archive, but database backups and Storage object durability are separate concerns under one vendor (§20). Untested restores, uncovered media, or vendor concentration would break the core promise in the one scenario where recovery matters — and the failure would only be discovered at the worst possible moment.

---

Prompt 03 complete. Current project status and next allowed task are tracked in `docs/memory.md`.
