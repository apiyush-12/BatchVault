# BatchVault — Product Requirements Document (PRD)

Status: Draft — MVP scoping
Source of truth: `/docs/project-context.md`
Prepared per: `/prompts/02_PRD.md`

---

## 1. Product Overview

BatchVault is a private, collaborative, digital time capsule for college batches. A batch (a group of classmates defined by institution, course, department, graduation year, and section) gets a dedicated, invite-only Batch Space where members collectively upload, organize, and preserve photos, short videos, captions, stories, and event/date metadata into a shared chronological archive. The product is designed for long-term emotional return — years or decades later — rather than daily social consumption.

## 2. Problem Statement

College memories are currently scattered across WhatsApp groups, personal phone galleries, and general-purpose cloud drives. These surfaces decay, get deleted, lose context over time, and are not searchable, structured, or owned collectively by the batch. There is no dedicated, private, permanent, collaborative space that a batch owns together to preserve its shared history in a structured and meaningful way.

## 3. Product Goals

1. Give every college batch a private, invite-only digital home for their shared memories.
2. Make it easy for classmates to collectively contribute photos, videos, captions, and events into one organized archive.
3. Preserve batch memories durably, so the archive remains meaningful and accessible 5, 10, or 20+ years later.
4. Protect batch privacy by default, at both the application and database level.
5. Provide a modern, emotional, premium mobile-first experience without becoming a generic social feed.

## 4. Non-Goals

- Not a generic social network.
- Not a general-purpose messaging app (no direct messaging / WhatsApp-Instagram replacement).
- Not a generic cloud file/drive manager.
- Not built for public, open, or discoverable content by default; batches are private and invite-only.
- Not optimized for daily social engagement, virality, or a follower/feed dynamic.
- Not a reels feed, dating product, marketplace, cryptocurrency/blockchain product, or live-streaming product.
- Not designed around facial recognition.
- Does not permanently preclude a future, explicit opt-in public showcase feature, but that feature is out of scope for the MVP and must never expose private content accidentally.

## 5. Primary User Types

- Current college students documenting their batch's journey as it happens.
- Graduating students preserving their final year and yearbook-style memories.
- Alumni (years post-graduation) returning to relive and rediscover shared history with old classmates.

## 6. User Personas

**Priya — Current Student (Batch Organizer)**
Final-year student who wants a shared, structured place to collect four years of batch photos and events before everyone scatters after graduation. Motivated to set up the batch space and drive adoption among classmates.

**Rahul — Active Contributor**
Enjoys taking and sharing photos/videos of college events. Wants a simple way to upload memories with context (captions, event, date) without them getting lost in a chat thread.

**Ananya — Alumna (Returning Member)**
Graduated 8 years ago. Rarely opens the app, but occasionally returns to revisit memories, especially around reunions or anniversaries. Wants the archive to still exist, still be accessible, and still feel like "home."

**Karan — Batch Admin / Moderator**
Was central to the batch's social life. Takes on responsibility for managing membership requests, keeping the space appropriate, and handling reported content.

## 7. Core Jobs-to-Be-Done

1. When our batch is together, help us collect our shared memories in one place we all own — not a personal photo dump.
2. When a new event happens, let a member quickly upload photos/videos with enough context (caption, date, event) that it makes sense later.
3. When I want to relive the past, let me browse our batch's memories chronologically or by event.
4. When someone new needs to join, let me safely control who gets into our private space.
5. When years have passed, let me trust that our archive is still there, still private, and still exportable.
6. When something inappropriate is posted, let someone responsible be able to act on it.

## 8. Main User Journeys

**Journey A — Create and seed a batch**
Sign up → complete profile onboarding → create a batch → define batch identity (name, institution, course, department, graduation year, section) → set batch privacy → invite classmates → classmates join (directly or pending approval) → first memories uploaded.

**Journey B — Contribute a memory**
Log in → open batch gallery → upload photo(s)/video(s) → add caption and event/date metadata → memory appears in gallery → other members react/comment.

**Journey C — Join an existing batch**
Receive invite → sign up or log in → request/accept join → (if required) wait for membership approval → gain access to batch gallery.

**Journey D — Revisit years later**
Log in after a long absence → open batch → browse gallery / memory detail pages chronologically or by event → react to and comment on old memories.

**Journey E — Manage the batch**
Owner/Admin/Moderator reviews members → approves or denies join requests → reviews reported content → removes content or members, each within their documented role ceilings (§12–13).

Settings are a separate power from moderation: **only Owner/Admin adjust batch settings, identity, and privacy.** A Moderator handles join requests, reports, and content moderation, and does not change batch settings.

## 9. Functional Requirements

1. **Signup/login** — Users can create an account and log in (Supabase Auth per the initial technology direction).
2. **Profile onboarding** — Users complete a basic profile (name, optional photo, batch-relevant identity info) after signup.
3. **Create batch** — A user can create a new batch and becomes its Batch Owner.
4. **Batch identity** — A batch has identifying attributes: institution, course/department, graduation year, section (or equivalent), and a display name.
5. **Batch privacy** — Each batch has an explicit privacy configuration (e.g., private/invite-only by default; any public exposure must be explicit and scoped to specific content, never the whole batch by default).
6. **Invite classmates** — Batch Owners/Admins can generate invites (e.g., link or code) to bring classmates in.
7. **Join batch** — An invited user redeems an invite link and, according to the batch's join policy, either becomes an **active** member or becomes a **pending** request awaiting approval. **Entry is invite-link only:** there is no discovery, search, or directory-based joining in MVP, and no way for a stranger to request access to a batch they were never given a link to (see §"Unresolved" 4, resolved; `security.md` §10).
8. **Membership approval where needed** — Depending on batch settings, joins may require Owner/Admin/Moderator approval before access is granted.
9. **Upload photos** — Members can upload photos to the batch archive.
10. **Upload short videos** — Members can upload short-form videos to the batch archive.
11. **Captions** — Uploaded memories can include a text caption.
12. **Event/date metadata** — Memories can be tagged with an event name and/or date to support chronological and event-based organization.
13. **Batch gallery** — A browsable view of the batch's memories (e.g., chronological, and/or grouped by event).
14. **Memory detail page** — A dedicated view for a single memory showing its media, caption, metadata, comments, and reactions.
15. **Comments** — Members can comment on a memory.
16. **Reactions** — Members can react to a memory (e.g., a lightweight reaction, not a generic like-count social mechanic).
17. **Basic member management** — Owners/Admins/Moderators can view members, approve/deny join requests, and remove members.
18. **Reporting/removal** — Members can report inappropriate content; authorized roles can remove reported content or take action.
19. **Batch settings** — Owners/Admins can configure batch-level settings (e.g., privacy, join approval requirement, batch identity details).

## 10. Non-Functional Requirements

1. **Privacy-by-default** — Private batch content must never be accessible to non-members; enforcement must exist at the backend/database level (e.g., Row Level Security), not only in UI logic.
2. **Data isolation** — One batch's data must never be visible or queryable by members of another batch, except explicitly published public content (out of MVP scope).
3. **Mobile-first** — Primary experience must be designed and usable on mobile devices first.
4. **Durability** — Uploaded media and metadata must be stored durably, with an architecture that anticipates long-term (multi-year, multi-decade) retention.
5. **Maintainability** — Architecture and code should remain maintainable as the product evolves; no unnecessary complexity.
6. **Accessibility** — Core flows must be usable with assistive technology and meet baseline accessibility expectations (see Section 19).
7. **Reasonable performance** — Core flows (gallery browsing, upload, memory detail) must perform acceptably on typical mobile network conditions (see Section 20).
8. **Security** — Authentication, authorization, and privacy protections must not be weakened for convenience at any stage of implementation.

## 11. Batch Privacy Model

- Batches are **private and invite-only by default**. Do not assume every batch is public.
- Batch content (photos, videos, captions, comments, reactions, member lists) is visible only to approved members of that batch, unless a piece of content is explicitly and individually marked public by an authorized role (future/opt-in capability, not required for MVP; architecture should not preclude it).
- There is no default mechanism for non-members to discover, browse, or preview private batch content.
- Enforcement of privacy must happen at the data layer (e.g., Row Level Security), so that privacy is guaranteed even if application-level logic has a bug — this is a security requirement, not just a UX preference.
- A batch's privacy configuration is explicit and owner/admin-controlled, not inferred.

## 12. Roles

- **Batch Owner** — Creator of the batch (or transferred ownership); highest authority within a batch; can configure privacy/settings, manage all roles below, and cannot be removed by lower roles.
- **Batch Admin** — Trusted role appointed by the Owner; can manage members, settings, and content moderation, short of removing the Owner or deleting the batch (deletion authority is a decision reserved for the Owner).
- **Moderator** — Role focused on content and community health; can review reports, remove inappropriate content/comments, and manage join requests, but has limited access to structural batch settings.
- **Member** — Standard batch participant; can upload memories, comment, react, and report content, within the boundaries of the batch's privacy settings.
- **Guest / Public Viewer (optional)** — Only relevant for explicitly public content in a future opt-in showcase scenario; has no default access to any private batch and no access to member-only interactions (comments, reactions, member lists) even where some content is public.

## 13. Permission Expectations

- Only approved Members (and higher roles) can view a private batch's content, gallery, and memory detail pages.
- Only Members and above can upload memories, comment, and react, within their own batch.
- Only Owner/Admin can modify batch settings and batch identity.
- Only Owner/Admin/Moderator can approve or deny join requests (when approval is required) and can act on reported content.
- Only Owner/Admin can manage roles (promote/demote Admin, Moderator).
- Only Owner can transfer ownership or delete the batch.
- A user cannot self-escalate their role.
- A user who is removed from a batch immediately loses access to that batch's private content.
- Permission checks must be enforced server-side/database-side, not solely on the client.

## 14. MVP Scope

Included (evaluated against Required MVP Capabilities):
- Signup/login
- Profile onboarding
- Create batch, batch identity, batch privacy
- Invite classmates, join batch, membership approval where needed
- Upload photos, upload short videos, captions, event/date metadata
- Batch gallery, memory detail page
- Comments, reactions
- Basic member management
- Reporting/removal
- Batch settings

Excluded from MVP (see Section 15 and Non-Goals):
- Direct messaging
- Public follower system
- Reels feed
- Dating
- Marketplace
- Cryptocurrency / blockchain
- Facial recognition
- Live streaming
- Public opt-in showcase feature (future, explicitly deferred)

## 15. Post-MVP Features

- Explicit, opt-in public showcase for selected content (never default; never exposes private content accidentally).
- "On This Day" / nostalgic resurfacing of past memories.
- Future-unlock time capsules (content that becomes visible only after a set future date).
- Rich digital yearbook experiences per batch/graduation year.
- Expanded data export/preservation tooling (formal export packages, archival formats).
- Albums / curated collections beyond basic chronological and event grouping.
- Advanced search across a batch's archive.

## 16. Edge Cases

- A batch with zero members other than the Owner (newly created, not yet invited anyone).
- A member uploads a memory, then leaves or is removed — ownership/visibility of their past contributions must be defined (contribution remains part of the batch archive; attribution may remain even if the uploader leaves).
- The Owner leaves the batch or deletes their account — ownership must transfer or be resolved, the batch must not become orphaned or inaccessible to remaining members.
- Duplicate/similar batches created for the same real-world batch (e.g., two students independently create "the same" batch) — no automatic merge; may need admin-assisted resolution.
- A join request to a batch that requires approval is never actioned — requester should not gain access; requester should be able to see request status or cancel.
- Large media uploads or unsupported file types/formats.
- A member reports their own upload (should be treated as a takedown/removal request, not standard moderation).
- A batch is set to a stricter privacy level after content already exists — prior content must respect the new setting going forward.
- Very old batches (alumni, years later) accessed after long dormancy — accounts, sessions, and stored media must remain valid/accessible.
- A user belongs to multiple batches — data and permissions must remain strictly isolated per batch.

## 17. Abuse / Moderation Considerations

- Members can report content (photos, videos, captions, comments) that is inappropriate, harassing, or violates batch norms.
- Reported content should be reviewable by Owner/Admin/Moderator, with an action path (remove content, warn/remove member).
- Removed content should be removed from all member views promptly; retention of removed content for dispute/audit purposes is an implementation decision, not a product requirement for MVP.
- Repeated abusive behavior by a member should be actionable via member removal by an authorized role.
- Since batches are private, moderation is scoped to batch-internal conduct; there is no cross-batch or public moderation surface in MVP.
- Uninvited/unauthorized join attempts to a private batch must be rejected by default, not merely hidden in the UI.

## 18. Data Portability Expectations

- Long-term preservation and future export must be considered from the start of the architecture, even though full export tooling is Post-MVP (Section 15).
- Members should be able to reasonably access/download their own uploaded content upon request, even in MVP, consistent with the product's preservation-first principle.
- Batch data should not be locked into a proprietary format that would make a future full-batch export infeasible.
- Deleting a batch (Owner-only, high-friction action) should be treated as a significant, ideally confirmable/reversible-for-a-period action given the product's preservation promise; exact mechanics (e.g., soft delete, grace period) are an implementation decision guided by this expectation, not a specification made here.

## 19. Accessibility Expectations

- Core flows (signup/login, onboarding, batch creation, join, upload, gallery browsing, memory detail, comments, reactions) must be usable with keyboard navigation and screen readers.
- Sufficient color contrast and legible typography, consistent with a modern, premium, accessible visual design.
- Media (photos/videos) should support meaningful text alternatives where feasible (e.g., captions serve this role for memories).
- Interactive elements (buttons, reactions, forms) must have accessible names/labels.
- Motion (e.g., Framer Motion transitions) should respect reduced-motion preferences.

## 20. Performance Expectations

- Mobile-first performance: core flows must remain usable on typical mobile networks and mid-range devices.
- Batch gallery browsing should support incremental/paginated loading rather than loading an entire batch archive at once.
- Media uploads (photos, short videos) should provide clear progress/feedback and handle typical mobile network interruptions gracefully.
- Memory detail pages should load promptly on first open, with heavier media (video) allowed to load progressively.
- Performance must not come at the cost of privacy enforcement (e.g., no client-side-only filtering of private data for speed).

## 21. Success Metrics

- Number of batches created and successfully seeded with at least one memory.
- Batch activation rate: percentage of created batches that reach a minimum number of active members and uploaded memories.
- Member join completion rate: percentage of invited users who complete signup and join a batch.
- Memory contribution breadth: percentage of batch members who upload at least one memory (collective participation, not single-contributor dominance).
- Long-term return behavior: batches/members that return and engage (view, react, comment) after a significant time gap (e.g., months later), reflecting the "return years later" emotional promise.
- Reported-content resolution: reported content is actioned by an authorized role within a reasonable time.
- Zero cross-batch privacy incidents (private content ever exposed outside its batch).

## 22. MVP Acceptance Criteria

1. A user can sign up, log in, and complete profile onboarding.
2. A user can create a batch with a defined batch identity and an explicit privacy setting.
3. A Batch Owner/Admin can invite classmates, and invited users can join, with membership approval enforced when configured.
4. A Member can upload a photo or short video with a caption and event/date metadata, and it appears in the batch gallery.
5. Any batch member can open a memory detail page to view media, caption, metadata, comments, and reactions.
6. Members can comment on and react to memories.
7. Owner/Admin/Moderator can view members and manage membership within their documented ceilings (approve, deny, remove — §12–13), **and Owner/Admin — not Moderator — can manage batch settings, identity, and privacy.**
8. Members can report content, and an authorized role can remove reported content.
9. A user who is not an approved member of a private batch cannot access that batch's gallery, memory detail pages, member list, comments, or reactions — verified at the backend/database level (e.g., Row Level Security), not only hidden in the UI.
10. No MVP feature includes direct messaging, a public follower system, a reels feed, dating, a marketplace, cryptocurrency/blockchain, facial recognition, or live streaming.

---

## MVP Summary (10 lines or fewer)

1. BatchVault MVP gives a college batch a private, invite-only space to preserve shared memories.
2. Users sign up, onboard, and create or join a batch with defined identity and privacy.
3. Joining can require Owner/Admin/Moderator approval.
4. Members upload photos and short videos with captions and event/date metadata.
5. Memories live in a batch gallery and individual memory detail pages.
6. Members comment on and react to memories.
7. Owners/Admins/Moderators manage members, settings, and reported content.
8. Privacy is enforced at the backend/database level, not just the UI.
9. No messaging, feeds, dating, marketplace, crypto, facial recognition, or live streaming.
10. Long-term preservation and future exportability are guiding principles, even though full export tooling is post-MVP.

## Unresolved Product Decisions

1. ~~Exact default privacy posture per batch at creation (e.g., "invite-only, no approval needed" vs. "invite-only, approval required" as the out-of-the-box default).~~ **RESOLVED** (Phase 2 / Prompt 14): the out-of-the-box default is **`invite_only_requires_approval`** — the safer posture, since a batch owner who has not yet thought about membership approval should not be exposed to unreviewed joins by default. This was already `database.md`'s schema default (§3.2, Q1); this entry confirms it as the product decision rather than merely a schema convenience.
2. ~~Whether membership approval is mandatory for all batches or a configurable Owner/Admin choice.~~ **RESOLVED** (Phase 2 / Prompt 14): **configurable.** `join_policy` is a per-batch setting (`invite_only_auto_approve` or `invite_only_requires_approval`), changeable by Owner/Admin at creation and afterward via batch settings (`security.md` §4's "Change batch settings / identity / join policy" row). Approval is never mandatory product-wide, and never optional in a way that bypasses invite-link-only entry (PRD unresolved #4, already resolved).
3. Precise reaction set (e.g., a single reaction vs. a small fixed set) — kept unspecified pending design.
4. ~~Whether non-member "requests to join" without an invite link are allowed at all in MVP, or invite-only strictly (no discovery/search of batches).~~ **RESOLVED** (recorded by the Prompt 11 audit; decided in `security.md` §10, not here): **invite-link entry only.** Batches are not discoverable — no search, no directory, and no endpoint that confirms a batch exists from its id — so a stranger cannot generate join requests against a batch they were never given. `phases.md` Phase 2 and Phase 3A already exclude discovery accordingly. A join *request* still exists, but only as the `pending` state produced by redeeming a link into an approval-required batch.
5. ~~Retention policy for removed/reported content (hard delete vs. soft delete/audit trail).~~ **RESOLVED** (Phase 8A, 2026-10-24): **soft delete**, consistent with the preservation-first, soft-delete-by-default pattern already built for memories/media (database.md §24; architecture §13). Moderator-removed content sets `deleted_at`/`deleted_by` and is hidden from every read path immediately; it is restorable by mod+ within a **30-day** retention window (this implementation's own figure, revisitable without a schema change, the same latitude the media size caps and signed-URL TTL were given). Hard-reaping of content past that window is **not** implemented in this session (no new cron sweep was added for memories/comments) — an accepted, named gap, not a silent omission; the existing `(deleted_at) WHERE deleted_at IS NOT NULL` indexes already anticipate it for whenever that sweep is built.
6. ~~Batch deletion mechanics (immediate vs. grace period) given the preservation promise.~~ **RESOLVED** (Phase 8B): **soft delete with a 30-day grace period**, Owner-only, behind a typed confirmation naming the batch. During the window the whole batch is invisible to every member (including by direct Storage path) and the Owner can restore it. After the window a scheduled sweep permanently deletes it **object-first** — every Storage object is removed before the database rows that name them. A batch taken down by a BatchVault operator (B4) cannot be restored by its Owner.
7. ~~Whether a Member can edit or delete their own uploaded memory after posting, and any time limits on that.~~ **RESOLVED** (Phase 4B decision, 2026-10-24): a Member **may edit** their own memory's `caption`/`event_name`/`occurred_on` at any time, with no time limit. A Member **may not self-delete** their own memory — there is no author self-delete capability in MVP. Removal of a memory (including the author's own) is **mod+ only**, through the existing audited moderator-removal path (Phase 8A). This keeps the preservation promise (§10 Non-Functional Requirement 4) simple: no new retention/grace-period/undo surface is introduced for author-initiated deletion, and the one deletion mechanism a batch already needs (moderation) is the only one that exists.
8. How multiple legitimately separate sections/years of "the same" institution/course are distinguished to avoid batch-identity confusion, without building a heavy discovery system (which is explicitly out of scope).

---

Prompt 02 complete. Current project status and next allowed task are tracked in `docs/memory.md`.
