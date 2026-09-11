# BatchVault — Security and Privacy Model

Status: Draft — MVP security model
Sources of truth: `/docs/project-context.md`, `/docs/PRD.md`, `/docs/architecture.md`, `/docs/database.md`
Prepared per: `/prompts/05_SECURITY.md`

**Scope.** This document defines intended security behaviour. It contains **no SQL, no policies, no code** — RLS behaviour is described in human-readable rules (§5) for implementation in a later step.

---

## The rule everything else serves

> **A person must never be able to read private batch data unless they are an authorized member of that batch.**
>
> Hiding a control in the UI is not authorization. Filtering rows in application code is not authorization. Authorization is a decision the database makes and can enforce even when every layer above it is wrong.

Every section below is either an implementation of that rule or an admission of where it is only partially achievable.

---

## 1. Threat Model

### 1.1 What we are protecting

| Asset | Why it matters |
|---|---|
| Batch media (photos, videos) | Irreplaceable, personal, often depicting minors-turned-adults over a 20-year horizon |
| Captions, comments, event metadata | Free text about real, named people; frequently more sensitive than the images |
| Membership lists | Reveals who studied with whom, where, and when — a social graph the product never publishes |
| Identity and contact data | Held in `auth.users`; deliberately not duplicated into `profiles` (database.md §3.1) |
| Invite tokens | **Bearer credentials.** Possession is access |
| Service-role key | Bypasses every guarantee in this document at once |
| Backups | Contain all of the above, outside RLS entirely |

### 1.2 Adversaries, in descending order of likelihood

| # | Adversary | Capability | Primary defence |
|---|---|---|---|
| **A1** | **Authenticated user who is not a member of batch X** | Valid session, public anon key, can call the Supabase API directly with arbitrary filters | **RLS.** This is the main adversary — a real account, a real token, and nothing but a policy between them and someone else's archive |
| A2 | Removed or rejected former member | Same, plus knowledge of real ids (batch, memory, storage paths) | RLS keyed on *current* membership status, not on history |
| A3 | Pending join requester | Same, plus a legitimate-looking row in `batch_members` | Policies test `status = 'active'`, never mere row existence |
| A4 | Holder of a leaked invite link | Can redeem into a batch | Expiry, revocation, use caps, member-only role, approval gate (§9) |
| A5 | Ordinary member seeking privilege | Can call any action with crafted parameters | Server-side role resolution; no role ever accepted from input (§11) |
| A6 | Moderator/admin exceeding their remit | Legitimate elevated access | Capability ceilings + audit log (§4, §20) |
| A7 | Unauthenticated stranger | Can reach every public endpoint and any leaked URL | Deny-by-default RLS where `auth.uid()` is NULL; no public buckets |
| A8 | Malicious uploader | Can store arbitrary bytes | Type allowlist, size caps, no SVG, safe serving headers (§14–16) |
| A9 | Compromised dependency | Executes inside the server runtime | Dependency policy; minimal server-side surface (§30) |
| A10 | Operator/insider with console or backup access | Reads anything | Accepted residual risk with controls (§26) |

### 1.3 Attack surfaces

1. **The Supabase REST endpoint, called directly from a browser.** The anon key is public by design and the API is internet-reachable. A user can skip the entire Next.js application and query tables themselves. **This is why RLS is the perimeter and not a backstop** — for this surface, there is no other layer.
2. Server Actions and Route Handlers (cron, webhooks, media routes).
3. Supabase Storage endpoints and any signed URL that has been minted.
4. The invite redemption path (unauthenticated until the token is presented).
5. The auth callback / redirect chain.
6. Backups and the independent export (architecture §20).

### 1.4 Explicitly out of scope for MVP

Nation-state adversaries; physical compromise of Supabase or Vercel; volumetric DDoS beyond ordinary rate limiting; compromise of the Supabase platform itself (accepted vendor risk, ADR-02); malicious *members* photographing their own screen (unsolvable, and irrelevant — they were shown the content legitimately).

---

## 2. Authentication Assumptions

Authentication is delegated to **Supabase Auth** (architecture §4). This document depends on the following being true; each is an assumption worth re-checking, not a fact to take on faith.

| # | Assumption | If it fails |
|---|---|---|
| A | Supabase Auth issues signed JWTs and Postgres verifies the signature before `auth.uid()` returns a value | Every RLS policy is bypassable — total loss |
| B | The session is transported per the **supported Supabase SSR cookie strategy** and is readable server-side (architecture §4) | Server-side authorization cannot identify the caller |
| C | `auth.uid()` inside a policy is the authenticated user and cannot be spoofed by request content | Total loss |
| D | Access tokens are short-lived and refresh is handled by the SSR client | Longer window for stolen-token replay |
| E | Email verification is enforced before an account is usable | Account takeover via unverified-email collision |
| F | Password hashing, reset flows, and OAuth handshakes are Supabase's responsibility | — |

**Non-assumptions — things we do not rely on:**

- We never trust a user id, role, batch id, or membership claim supplied in a request body. Identity comes from the verified session; everything else is re-derived server-side.
- We never treat "has a session" as "is authorized". A session identifies; it does not entitle (architecture §4).
- We do not write custom cryptography, custom session handling, or a custom password store.

**Known gaps, accepted for MVP:** no MFA (worth revisiting before the archive is large); no device/session management UI; no step-up authentication for destructive actions such as batch deletion. Each is a candidate for post-MVP, and batch deletion in particular deserves re-authentication (§24).

---

## 3. Authorization Model

**Authorization is a function of three things: the caller, the batch that owns the row, and the action.** Never of the caller alone, and never of row ownership alone.

```
authorized(caller, row, action)
    = membership(caller, row.batch_id).status = 'active'
    AND membership(caller, row.batch_id).role >= required_role(action)
    AND row.batch_id is not soft-deleted
```

Three enforcement layers, all required, in strictly increasing authority:

| Layer | Mechanism | Purpose | Trusted as the guarantee? |
|---|---|---|---|
| 1 | UI hides or disables controls | Usability — do not offer what will fail | **No.** Never |
| 2 | Server Action / Route Handler checks | Good errors, early failure, catches mistakes in review | No |
| 3 | **The database boundary** — RLS for direct table access, **plus the explicit authorization logic inside a privileged RPC** where one is used | The boundary | **Yes** |

Layer 3 exists because Layers 1 and 2 protect only traffic that goes *through the application*, and §1.3 establishes that a browser can talk to Postgres directly.

**Layer 3 has two forms, and conflating them would be a mistake.** For ordinary direct table access, RLS is the boundary — a policy the caller cannot influence. But the high-risk writes in §5.2 are performed by **privileged database functions that intentionally execute with rights the caller does not have**, and inside such a function RLS is not what authorizes the write. There, the function's own explicit checks *are* the boundary. Both are database-side and neither is bypassable from the application, which is why they sit in the same layer — but the mechanism differs, and §5.2.2 sets out what that demands.

**Principles**

- **Deny by default.** A table with RLS enabled and no matching policy returns nothing. New tables start there and gain access deliberately.
- **Fail closed on NULL.** `auth.uid()` is NULL for an unauthenticated caller; every predicate must evaluate to false in that case, never to NULL-that-somehow-passes.
- **Membership-derived, not user-derived.** Authorship grants no read access on its own; a removed member does not retain access to memories they uploaded.
- **Pending is not access** (A3).
- **Removal is immediate at the database layer** — with one honest exception for already-minted signed URLs (§8).
- **No self-escalation**, ever (§11).
- **Indistinguishable denial.** An unauthorized read and a nonexistent row return the same thing. A stranger must not be able to learn that batch `X` exists by observing a different error (architecture §18.6).

---

## 4. Batch Role Permissions

Roles, highest capability first (*presentation order; the enum is declared ascending — database.md §15*): **Owner → Admin → Moderator → Member**. Non-members and pending requesters hold no capabilities at all.

| Capability | Owner | Admin | Moderator | Member | Pending | Non-member |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| View batch content, gallery, memory detail | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View member list | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Upload memories / media | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Comment, react | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit / delete **own** memory or comment | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| File a report | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View the report queue | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remove **others'** content | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve / reject join requests | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remove a member | ✅ | ✅ | ⚠️ *member only* | ❌ | ❌ | ❌ |
| Create / revoke invite links | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change batch settings / identity / join policy | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Promote / demote to moderator | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Promote / demote to admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete the batch | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View the audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Ceiling rules that the matrix cannot show:**

1. **No one may act on a peer or superior.** A moderator cannot remove an admin; an admin cannot remove another admin or the owner. The rank of the *target* is checked, not only the rank of the actor.
2. **An actor may only assign roles strictly below their own authority.** Not "roles they hold" — that phrasing was wrong in both directions, since it would forbid an owner from granting admin while permitting an admin to mint another admin. Concretely: **owner** may assign admin and moderator; **admin** may assign moderator; **moderator** may assign nothing. Ownership is never assigned through this path at all — it moves only through the dedicated transfer flow (§11).
3. **No self-service role change**, in either direction — with exactly one exception, ownership transfer, defined in §11.
4. **Every row in the bottom third of this table is audit-logged** (§20).

---

## 5. Row Level Security Strategy

*(Human-readable intent. No SQL — policies are written in a later step.)*

### 5.1 Ground rules

1. **RLS enabled on every table in the application schema**, without exception, including post-MVP tables the day they are created.
2. **`FORCE ROW LEVEL SECURITY`** so the table owner is not silently exempt.
3. **Separate policies per command** — `SELECT`, `INSERT`, `UPDATE`, `DELETE` are distinct decisions and must not share one permissive policy.
4. **Every write policy carries a write-side check**, not just a read filter. Without it a member of batch A can *insert* a row claiming `batch_id` of batch B: the read filter would hide it from them afterwards, but the row would exist inside someone else's archive.
5. **Column-level control wherever row-level is not enough — which is everywhere direct DML survives.** RLS answers *which row*; it says nothing about *which fields*. Two read/immutability cases: `batch_invites.token_hash` must not be selectable by any client role (§9), and `reports.target_kind` / `reports.target_id` must not be updatable (database.md §3.9). Beyond those, **every remaining direct-DML path needs an explicit writable-column set** — `profiles`, `memories`, `comments`, `reactions` — specified in §5.4.1.
6. **Tables with no legitimate direct-client use are not exposed to the API at all.** `audit_logs` is written by privileged functions and read through a narrow path; direct grants to client roles are revoked rather than merely policy-restricted.
7. **Soft-deleted rows are invisible.** Every content policy requires `deleted_at IS NULL`, and every membership predicate additionally requires the *batch* not to be soft-deleted. Restoration is a privileged operation, not a normal read.
8. **RLS is necessary but not sufficient for writes.** Some operations cannot be made safe by a row predicate alone, because their safety depends on values the client must not choose or on several rows changing together. Those writes are removed from the direct API surface entirely — see §5.2.

### 5.2 Which writes may be direct DML, and which must not be

§1.3 establishes that a browser can call PostgREST directly. That cuts both ways: it is not only a *read* threat. If a client role holds `INSERT` on a table, the client can insert into it with values of its choosing, and the only thing standing in the way is a `WITH CHECK` predicate evaluated against the row it supplied.

For some rows that is enough — a comment is a batch id, a memory id and some text, and a predicate can verify all three. For others it is fundamentally not enough, because the operation's safety depends on one of:

- **Server-generated values the caller must not pick** (an invite token hash, a storage path, an immutable report snapshot, an audit record).
- **Multi-row atomicity** (a batch and its owner membership; a demotion and a promotion).
- **State the client must not be trusted to compute** (whether an invite is still valid; whether a join policy requires approval; what role a redemption yields).

**Therefore: for MVP, client roles hold no direct `INSERT`/`UPDATE`/`DELETE` on the following operations.** The privilege is revoked at the grant level, so there is no policy to get wrong and nothing for a direct PostgREST call to attempt:

| Operation | Why it cannot be direct DML |
|---|---|
| Batch creation + initial owner membership | Two rows, one logical act; a partial failure leaves an ownerless batch (§5.2.1) |
| Invite creation | Token generation and hashing are server-side; a client-chosen `token_hash` is a forged credential |
| Invite redemption / membership creation | Validity, use-count increment and join-policy resolution must happen under a row lock |
| Membership approval / rejection / removal | Requires evaluating the actor's rank against the target's |
| Role changes | Rank ceilings (§11) are cross-row logic, not a row predicate |
| Ownership transfer | Two role changes that must not be separable |
| Media preallocation and finalize | The server composes the storage path and reads back authoritative object metadata |
| Report creation | The immutable `target_kind`/`target_id` snapshot must be derived server-side, not asserted |
| Audit-log insertion | Append-only, written by the action it records |
| Batch deletion / restoration | Ordered, multi-system, and irreversible (§24) |

Each is exposed instead as a **narrow, validated SQL function (RPC)** — or an equivalent server-controlled transactional path — that derives the caller from `auth.uid()`, authorizes explicitly, and performs the whole operation in one transaction.

**This list is the complete set of *high-risk* privileged operations, and it does not change.** A second, much narrower category also exists — single-field controlled writes that let the product legitimately set a protected system field (for example, completing one's own onboarding). Those are **not** on this list, are not security-critical multi-row operations, and are specified separately in **§5.4.3**.

**RLS remains enabled and forced on every one of these tables**, and the policies remain the guarantee for everything *reading* those rows afterwards. But the write path itself needs a more careful account than "it sits on top of RLS" — see §5.2.2.

**Concretely, the rule that must not be violated:** *no policy may exist that lets a caller create their own `batch_members` row by supplying a batch id.* That single permission would make every invite control in §9 decorative — an attacker who learns a batch id could simply join. Membership rows come from the redemption function or from a moderator's decision, never from a client-authored `INSERT`.

#### 5.2.1 Batch creation is atomic

Creating a batch and creating its owner membership are **one logical operation**, and a `batches` row without an active owner is a corrupt state: it cannot be administered, cannot transfer ownership, and cannot be deleted (§11).

Normal clients must therefore have **no direct `INSERT` on `batches`**. Batch creation is a single database function/transaction that:

1. derives the creator from `auth.uid()` — never from a caller-supplied id;
2. inserts the `batches` row;
3. inserts the caller's `batch_members` row as `role = 'owner'`, `status = 'active'`;
4. commits both or neither, so **no partial failure can leave an ownerless batch**.

The design is not implemented here. What is fixed is the invariant: *a batch and its first owner come into existence together.*

#### 5.2.2 How an RPC-only write actually executes

There is a consistency problem in the three statements above that has to be resolved rather than glossed over:

1. Client roles hold **no** `INSERT`/`UPDATE`/`DELETE` on these tables.
2. Authenticated users perform these writes by calling SQL functions.
3. RLS is the authorization guarantee.

**A normal `SECURITY INVOKER` function executes with the caller's privileges.** If the caller has no `INSERT` privilege on `batch_members`, an invoker function they call cannot insert into `batch_members` either — it fails on the missing grant. So statements (1) and (2) cannot both be true unless the function runs as something other than the caller.

**The intended model.** An RPC-only write that requires table privileges the caller does not hold must execute through a **deliberately privileged database function boundary** — normally a narrowly scoped `SECURITY DEFINER` function, or an equivalent intentionally privileged database execution role. This is a design decision, not an accident of configuration, and it carries obligations.

**Every privileged RPC must:**

- **Derive the caller from `auth.uid()`** — never from a parameter, never from anything in the request body.
- **Never accept caller-supplied identity or privilege claims.** No actor id, no role, no "I am an admin of this batch".
- **Explicitly authorize, before writing**, every invariant the operation depends on: the actor's active membership; the target batch; the target member where one exists; role ceilings (§4, §11); the legality of the state transition being requested; and any operation-specific rule such as invite validity, use caps, or the exactly-one-owner constraint.
- Use **fully schema-qualified names** throughout.
- Use a **pinned empty/safe `search_path`**.
- Contain **no dynamic SQL**. None.
- Be granted **`EXECUTE` to the minimum set of roles**, and nothing wider.
- Have its **ownership and `BYPASSRLS` behaviour explicitly chosen and verified in the target Supabase environment** — the same requirement, for the same reason, as the membership helper in §5.3. `SECURITY DEFINER` interacts with `FORCE ROW LEVEL SECURITY`, and what a given owner can actually do must be proven rather than assumed.
- Have **adversarial tests** (§5.6): a non-member calling it, a member calling it for another batch, a moderator attempting an admin-level action, a caller attempting to act on themselves where forbidden, and a caller passing a well-formed but unauthorized target.

**The trust boundary, stated precisely.**

| Path | What authorizes the operation |
|---|---|
| Direct table access (reads, and the four direct-DML categories in §5.4) | **RLS for the row, plus column-level enforcement for the fields** (§5.4.1). The caller can influence neither |
| A privileged RPC executing with rights the caller lacks | **The function's own explicit authorization logic**, which is itself a trusted security boundary for that operation |

**Do not claim RLS re-authorizes writes performed inside a definer function.** If the function's execution role bypasses the relevant policies — which is precisely why it can write at all — then the policies are not running on those statements, and asserting otherwise would be a false sense of safety in exactly the place that most needs a real one.

What this changes in practice: **each privileged RPC is security-critical code and is reviewed as such.** The set is deliberately small (§5.2) so that the total amount of trusted authorization logic stays small enough to read in one sitting. Revoking direct client DML is still worth doing — it removes the whole class of "craft a row and POST it" attacks and forces every high-risk write through code that can be reviewed — but it is a narrowing of the attack surface, not an additional independent check on the writes that remain.

### 5.3 The membership predicate, and its one real trap

Nearly every policy reduces to one question: *is the caller an active member of this row's batch, at or above role R?* This is centralised in a SQL helper function (architecture §5) so it is written once and reviewed once.

**The trap:** a policy on `batch_members` that itself queries `batch_members` recurses, and Postgres will either error or — worse, depending on how it is written — behave unpredictably.

The usual mitigation is a **`SECURITY DEFINER`** helper. That is the right direction, but the earlier phrasing was too casual about it, and the detail matters:

**`SECURITY DEFINER` is not a magic RLS bypass, and it interacts with `FORCE ROW LEVEL SECURITY`.** A definer function runs as its *owner*, so whether its internal lookup is subject to policies depends entirely on **who that owner is and what that role is permitted to do**. Ground rule 2 (§5.1) forces RLS even for the table owner, precisely so that owning a table is not an accidental exemption — which means "make it `SECURITY DEFINER`" does not by itself guarantee the helper can read `batch_members` unfiltered. The owner and execution model must be **chosen deliberately** against Supabase's actual role model, and the resulting behaviour **verified in the target environment before any policy depends on it**.

Because the helper is, by construction, a small piece of code that reads data its caller cannot, it is a **privilege-escalation surface** and is constrained accordingly:

- **Dedicated and narrow.** It answers one question. It is not a general-purpose data accessor, and it is not extended later for convenience.
- **Current caller only.** It resolves `auth.uid()` internally and takes no user-id parameter, so it can never be turned into an oracle for "is *that* person in *that* batch".
- **Fully schema-qualified object names**, so nothing it references can be resolved ambiguously.
- **Pinned empty/safe `search_path`**, so no caller-controlled schema can shadow an object it uses. This is simultaneously the SQL-injection control for definer functions (§28).
- **No dynamic SQL.** None. A definer function building a statement from input is the classic escalation bug.
- **`STABLE`** volatility, so it can be evaluated efficiently inside a query.
- **Minimum `EXECUTE` grants** — only the roles that must call it.
- **Verified, not assumed:** confirm the owner's `BYPASSRLS`/ownership behaviour in the deployed Supabase environment, and add a negative test proving the helper cannot be used to learn about batches the caller is not in.

Getting this wrong is the single most likely way to ship a broken privacy boundary, which is why it is spelled out here rather than left to the policy-writing step.

### 5.4 Intended behaviour per table

Notation: **member** = active membership at any role; **mod+** = moderator, admin or owner; **admin+** = admin or owner.
**RPC only** = the client role holds no direct DML privilege; the write happens exclusively through a validated SQL function (§5.2). Where a write is RPC-only, the policy column describes what that function is permitted to do on the caller's behalf, **not** a permission a direct PostgREST call could exercise.

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | Own profile always. Other profiles **only where a batch is shared** with the caller — a global directory would leak the existence of people and, by inference, batches | Own row only, at signup | Own row only | None (account deletion is a privileged flow, §22) |
| `batches` | Members of that batch. Plus a **deliberately minimal** unauthenticated read for invite landing (§9) — name only, delivered through a function, not by opening the table | **RPC only** — atomic create-batch-with-owner (§5.2.1). No direct insert, so no batch can exist without an owner | **RPC only** — admin+ settings changes | None — soft delete only, owner, ordered (§24) |
| `batch_members` | Members see the roster of their own batches. A pending requester sees **only their own row**, so they can tell their request is pending without learning who else is in the batch | **RPC only.** Rows are created by invite redemption or by the batch-creation function. **A caller can never insert a membership by supplying a batch id** | **RPC only** — approval/rejection/removal and role changes, each enforcing the §4 and §11 ceilings | None — status transitions only (database.md §12) |
| `batch_invites` | admin+ of that batch, **excluding `token_hash`** (column privilege, §9) | **RPC only** — the server generates and hashes the token; a client-supplied hash would be a forged credential | **RPC only** — admin+ revoke; `use_count` moves only inside the redemption transaction | None while the batch lives (database.md §3.4) |
| `memories` | member, `deleted_at IS NULL`, *(post-MVP: and not capsule-locked, §5.5)* | **RPC only** — created by media finalize, which owns the transaction | Author edits own caption/metadata (direct DML acceptable, policy-checked); removal by mod+ is RPC (audited); author self-delete is **gated on PRD #7** and, if permitted, uses the controlled path in §5.4.3 — never a direct `deleted_at` write | None — soft delete only |
| `media_assets` | member, and only rows whose memory is visible to them; `pending`/`rejected` rows readable only by their uploader | **RPC only** — preallocation composes the storage path server-side | **RPC only** — finalize writes authoritative object metadata; mod+ removal | None — soft delete, then privileged reap |
| `comments` | member, `deleted_at IS NULL`, **and the parent memory is visible** (§5.4.2) | Direct DML acceptable: member, with a write-side check that `batch_id`/`memory_id` resolve to a batch they are actively in **and that the parent memory is currently visible and open to interaction** | Author edits own body (direct); mod+ removal is RPC (audited) | None — soft delete only |
| `reactions` | member, **and the parent memory is visible** (§5.4.2) | Direct DML acceptable: member, **for themselves only** — `profile_id` is bound to `auth.uid()` by the database, not taken from the payload (§5.4.1) — **and the parent memory must be visible and open to interaction** | Own reaction only, `kind` only | Own reaction only |
| `reports` | **mod+ only.** Reporters do *not* get to read the queue, and a reported member must never see the report or learn who filed it | **RPC only** — the immutable `target_kind`/`target_id` snapshot is derived server-side, never asserted by the caller | **RPC only** — mod+ resolution fields; snapshot columns are not updatable by anyone | None |
| `audit_logs` | admin+ of that batch. Not exposed for direct client query | **RPC only** — written by the action being recorded | **Nobody** — append-only by privilege | **Nobody** |

**What remains as ordinary policy-checked DML** — four categories, not three:

| Category | Operations |
|---|---|
| Batch content: comments | Create, and author editing their own body |
| Batch content: reactions | Create, switch kind, remove one's own |
| Batch content: own memory text | Author editing caption / `event_name` / `occurred_on` |
| **Profile self-service** | Create own profile at signup, edit own presentation fields |

Everything else is a function call. That is a deliberate narrowing of the attack surface — most of the interesting write logic is simply not reachable from a direct API call. But narrowing is not the same as securing: the four categories above still need column-level constraints, which is §5.4.1.

#### 5.4.1 Column-level write restrictions for direct-DML paths

**The principle:**

> **RLS decides *which row* a direct-DML caller may touch. Column privileges and immutable-field enforcement decide *which fields of that row* they may control. Both are required.**

A row-level policy that says "you may update your own comment" does not, by itself, stop that update from also rewriting `batch_id`, `author_id` or `deleted_at`. PostgREST sends whatever columns the caller includes; unless something restricts the column set, an `UPDATE` authorized by row is an `UPDATE` of *any* column in that row. That turns a legitimate edit into a way to move a comment into another batch, reassign its authorship, or un-delete moderated content — none of which any policy in §5.4 intends to permit.

The minimum required restrictions:

| Table | Directly writable | Must **not** be writable via ordinary DML |
|---|---|---|
| `profiles` | `display_name`, `bio` | `id`, `avatar_path` (see below), `created_at`, `updated_at`, `deleted_at`, `onboarding_completed_at` and any other system-managed field |
| `memories` | `caption`, `event_name`, `occurred_on` | `batch_id`, `created_by`, `created_at`, `deleted_at`, `deleted_by` |
| `comments` | `body` (and any field deliberately made user-editable, e.g. `edited_at` if set by default rather than by the caller) | `batch_id`, `memory_id`, `author_id`, `created_at`, `deleted_at`, `deleted_by` |
| `reactions` | `kind` | `batch_id`, `memory_id`, `profile_id`, `created_at` |

**`avatar_path` is not free-text presentation data.** It names a Storage object, and §6 establishes that clients do not choose Storage paths. Leaving it freely writable would contradict that directly and would let a user point their avatar at **another profile's object** — displaying someone else's face as their own, and quietly obtaining a read handle to an object they may not be entitled to. It is therefore removed from the ordinary self-service set:

- `display_name` and `bio` remain ordinary profile self-service fields.
- **`avatar_path` is set only by the controlled avatar upload/change flow**, or is database-constrained to an exact caller-owned, server-generated avatar path (first segment `= auth.uid()`, §6.1).
- A user must **never** be able to set `avatar_path` to another profile's object, to a batch-media object, or to an arbitrary Storage path.

**Profile identity — insert and update differ.** `profiles.id` is the same UUID as `auth.users.id` (database.md §3.1), so it is both the primary key and an identity claim. The rules are not the same for the two operations:

| Operation | Rule |
|---|---|
| **INSERT** (signup) | `id` must be **derived/defaulted from `auth.uid()`**, or — if it is supplied in the payload — the database must **independently require it to equal `auth.uid()`**. Otherwise one authenticated user could create a profile row for a different auth user, seeding an identity they do not own |
| **UPDATE** | `id` is **immutable and never writable**, by anyone, through any ordinary path |

**Identity binding on insert.** For `comments.author_id` and `reactions.profile_id`, the identity must be **bound to `auth.uid()` by the database**, not taken on trust:

- **Preferred:** the column defaults to `auth.uid()` and is not writable by the client at all, so the caller never chooses it.
- **Acceptable:** the caller's payload may technically carry the value, *provided the database independently requires it to equal `auth.uid()`* through a write-side condition. In that arrangement the supplied value is not authoritative — it is a claim the database re-derives and rejects on mismatch.
- **Never:** accepting a caller-supplied author or profile id as the identity of record.

The same reasoning applies to `memories.created_by` and to `batch_id` on any content insert: `batch_id` must be validated against the caller's active membership on the write side, not merely filtered on read.

**Mechanism is an implementation choice; enforcement is not optional.** Column-level `GRANT`/`REVOKE`, column defaults tied to `auth.uid()`, write-side conditions comparing new values to old, immutability constraints, or routing a specific field change through its own narrow RPC are all acceptable — whatever is chosen must be **enforced by the database**, so that a direct PostgREST call including an extra column fails rather than succeeds quietly. Application-side field filtering does not qualify, for the same reason UI hiding does not qualify as authorization.

#### 5.4.2 Child rows inherit their parent memory's visibility

Comments and reactions are **not independently visible just because the caller is in the batch.** Their visibility is conditional on the memory they hang off, and that condition has to be in the policy — otherwise a moderator removing a memory leaves its comment thread readable, and every reply quoting or describing the removed content stays exposed. The photograph would be hidden and the discussion of it would not.

**Reads**

- A **comment** is visible when the comment itself is not deleted **and** its parent memory is visible to the caller — which already folds in `memories.deleted_at IS NULL`, active membership, the batch not being soft-deleted, and (post-MVP) the capsule lock.
- A **reaction** is visible when its parent memory is visible.

**Writes — the same condition, enforced on the write side**

- A member may comment or react **only on a memory currently visible to them**. Membership in the batch is not enough.
- **No interaction with soft-deleted content.** A member must not be able to comment on or react to a memory that has been deleted or moderated away — including by replaying a memory id they held from before the removal.
- **Post-MVP: no interaction with locked content.** A memory sealed in a time capsule must not accept comments or reactions before unlock; accepting them would leak the memory's existence and let the batch discuss content none of them can see.

This applies to **direct reads and direct DML alike**, which is the point: a client holding `INSERT` on `comments` will post to any memory id it can name, so the parent-visibility test has to live in the write-side check rather than in the UI that normally prevents it.

#### 5.4.3 Controlled write paths for protected system fields

*(Added by the Prompt 11 audit, which found that a protected field can be specified as unwritable without any documented way for the product to legitimately set it — an implementation-blocking gap, not a security decision.)*

A field being **unwritable by ordinary DML** does not mean it is unwritable by the system. Some protected system fields must still change as a normal part of the product working. Those changes happen through a **narrow controlled write path** — a single-purpose, database-enforced mutation whose only job is to set that one field under a precondition the caller cannot influence.

**This category is deliberately distinct from the high-risk RPC-only operations in §5.2.** Those eleven operations are multi-row, privilege-sensitive, and security-critical. A controlled system-field write is narrower: one field, one precondition, no role hierarchy to adjudicate. Listing it here does **not** expand §5.2's list, and does **not** make the field client-writable.

Every controlled system-field write path must:

- derive the acting user from `auth.uid()` — never from a parameter;
- **set the protected field server-side** (e.g. to `now()`), never from a caller-supplied value — a caller must not be able to choose a system timestamp (§13);
- expose **no other column** for writing through that path;
- enforce its precondition in the database, not in the application;
- follow the same hardening as any privileged function where it executes as one (schema-qualified names, pinned safe `search_path`, no dynamic SQL, minimum `EXECUTE` grants — §5.2.2);
- have both a positive test (the legitimate path succeeds) and a negative test (the field remains unwritable by direct DML) — §5.6.

**The cases this covers in MVP:**

| Protected field | Legitimate change | Precondition the database enforces |
|---|---|---|
| `profiles.onboarding_completed_at` | Marking one's **own** onboarding complete, so the caller can proceed past the onboarding gate (architecture §4; PRD §9.2; database.md §3.1) | Target row is the caller's own profile; the required profile fields are actually present; the value is server-generated; re-running does not rewrite an already-set completion |
| `profiles.avatar_path` | The controlled avatar upload/change flow (§5.4.1 above) | Path is a caller-owned, server-generated avatar path whose first segment `= auth.uid()` (§6.1) |
| `memories.deleted_at` / `deleted_by` — **author self-delete** | **Gated: only if and when PRD unresolved decision #7 permits author self-delete, including any time limit.** Moderator removal is already an audited RPC (§5.4, §19) | Caller is the author; the memory is currently visible to them; any PRD #7 time limit has not elapsed; `deleted_by` is set from `auth.uid()` |
| `comments.deleted_at` / `deleted_by` — **author self-delete** | **Not in MVP phase scope** (`phases.md` Phase 6 ships comment create + author body edit only). `database.md` §3.7 anticipates the column supporting it; that is a schema affordance, not a shipped capability | If it is ever scheduled, same shape as the memory case above, decided separately — comment and memory self-delete rules are **not** assumed identical |

No final SQL function names or signatures are fixed here; only the invariants are. An implementer may satisfy a row in this table with a narrow function, a tightly-scoped policy plus column grant, or an equivalent database-enforced mechanism — provided a direct PostgREST write of the protected field still fails.

### 5.5 Post-MVP predicates that must not be forgotten

- **Time capsules** add one clause to the payload-bearing rows: content is invisible while `locked_until` is in the future, evaluated at read time. Both `memories` and `time_capsule_entries` carry their own lock, because a lock on the grouping table protects nothing (database.md §22). **No scheduled job unlocks content** — a cron that fires early is a privacy breach and a cron that fails is a broken promise.
- **Public showcase** (ADR-12) must be an explicit publication into a separate space, never a relaxation of a private-content policy. A published artifact is a copy with its own policy; the private row's policy is never widened.

### 5.6 How this gets verified

Policies fail *silently* when they are too permissive — nothing errors, nothing logs, the data simply comes back. Testing must therefore be adversarial and negative, run in CI:

- For every table, a non-member attempts read, insert, update and delete **through the REST API directly**, not through the app, and gets nothing.
- Repeat as: pending requester, rejected requester, removed member, member of a *different* batch.
- A member of batch A attempts to insert a row carrying batch B's id.
- **A user attempts a direct PostgREST `INSERT` into `batch_members` supplying a batch id** — the single most important negative test in the suite, since success would make every invite control decorative.
- Direct DML is attempted against each RPC-only operation in §5.2 and is refused at the privilege level, not merely by a policy.
- The membership helper (§5.3) is called with intent to learn about a batch the caller is not in, and reveals nothing.
- A member attempts to set their own role; a moderator attempts to remove an admin; an admin attempts to create another admin.
- A soft-deleted memory does not appear in any read path.
- Cross-batch: a user in two batches sees exactly two batches' worth of data and no more.

**Column-level tests for the direct-DML paths (§5.4.1).** Each of these is an *authorized* caller updating a row they legitimately own, but including a column they must not control. Every one must fail at the database:

- A **memory author** updating their own memory attempts to change `batch_id` — moving their memory into another batch — and separately attempts to change `created_by`.
- A **comment author** editing their own comment attempts to change `memory_id` or `batch_id` (relocating it to another memory or batch), and separately attempts to change `author_id`.
- A **reaction owner** updating their own reaction attempts to rewrite `profile_id`, `memory_id` or `batch_id`.
- A **profile owner** editing their own profile attempts to rewrite `id`, or to set `deleted_at` or another system/deletion field.
- A **profile owner** attempts to set `avatar_path` to **another profile's** avatar object, and separately to an arbitrary or batch-media path.
- **One authenticated user attempts to INSERT a profile row whose `id` is another auth user's id** — it must fail, or the supplied id must be overridden by `auth.uid()`; a profile for an identity you do not own must never come into existence.
- **Each controlled system-field write path (§5.4.3) gets a matched pair**: the legitimate path succeeds for its own row under its precondition (e.g. a user completes their own onboarding), **and** the same field remains unwritable through ordinary direct DML — including an attempt to set it on *another* user's row, and an attempt to supply a caller-chosen timestamp rather than the server-generated one.
- A caller inserting a comment or reaction supplies an `author_id` / `profile_id` **other than their own** and is rejected (or has it overridden by the database default — whichever mechanism §5.4.1 selects, the outcome must be that the forged value never persists).
- A **role-change caller forges their actor role** in the request payload while requesting an otherwise-legitimate target role — for example a moderator claiming to be an owner while promoting someone to admin — and the RPC resolves their real role from `batch_members` and refuses.

These matter because row-level tests pass in all of these cases. The row is the caller's own; only the column set is wrong. A suite that tests only "can I touch someone else's row" would miss every one of them.

A new table without a matching set of negative tests should be treated as unreviewed, and a new directly-writable column without a column-level test should be treated the same way.

---

## 6. Storage Bucket / Path Strategy

Three buckets, **all private** (architecture §7):

| Bucket | Contents | Path shape |
|---|---|---|
| batch media | Photos, videos, posters, future derivatives | `{batch_id}/{media_asset_id}` |
| avatars | Profile images | `{profile_id}/{asset_id}` |
| *(future)* showcase | Explicitly published content only | Separate, never shared with the above |

**The two private buckets have different path shapes and therefore different authorization models.** An earlier draft said "the first path segment is the batch id" as though it were universal; it is true only of batch media. Avatars are keyed by profile, and no batch id can be parsed from an avatar path.

**Rules**

1. **No public bucket holds batch content.** There is no MVP configuration in which an unauthenticated URL returns a private photo.
2. **Paths are server-composed from server-generated UUIDs.** The client never chooses, supplies or influences a path, and original filenames are never path components (database.md §3.6).
3. **Path parsing fails closed.** A malformed object name, a missing segment, or a segment that is not a UUID denies access rather than falling through to a permissive branch.
4. **Batch media: the first path segment is the batch id**, which lets Storage policies reach the same membership question as the table policies. **Membership alone is not sufficient authorization** — the object's database state must be consulted too (§7).
5. **Avatars are private, and authorized separately** (§6.1). A public avatar bucket would allow enumeration confirming which accounts exist and would leak a person's face to anyone with a URL.
6. **The showcase bucket is the only one that could ever become public**, and only via an explicit copy-on-publish. Publication never widens permissions on a private object.

### 6.1 Avatar authorization

The avatar path is `{profile_id}/{asset_id}`. There is no batch id in it, so avatar access **cannot** be decided by the batch-media predicate:

- **A user may read and manage their own avatar objects** — the first path segment equals `auth.uid()`.
- **Another user may read an avatar only where profile visibility permits it**, which in MVP means the two share an **active** batch (the same rule that governs reading the `profiles` row itself, §5.4). Avatar visibility and profile visibility must not diverge; if you cannot see the person, you cannot see their face.
- **There is no avatar directory and no enumeration path.** Knowing a profile id must not be sufficient to fetch its avatar.
- **Removal from the last shared batch removes the basis for access.** Once no active shared batch remains, the former co-member loses avatar read access along with everything else — subject to the same already-minted-URL caveat as all Storage content (§8).

### 6.2 Storage write authorization for batch media

The browser uploads bytes directly (architecture §8), which means Storage write permission is exposed to the client. It must be scoped so narrowly that the only thing a client can do is complete the exact upload the server already authorized.

**An authenticated upload must be constrained to a single server-preallocated `pending` `media_assets` record**, such that all of the following hold:

- the object path **exactly matches** the server-generated `{batch_id}/{media_asset_id}`;
- a `media_assets` row exists for that id with **`status = 'pending'`**;
- that row's **`created_by = auth.uid()`** — a caller can only complete *their own* preallocation;
- the caller is an **active member** of that batch;
- the caller **cannot substitute another member's media id or path**, because the id must resolve to a pending row they own;
- **a `ready` object cannot be overwritten** through the ordinary upload path — finalized archive content is not client-writable, or a member could silently replace a memory's image after the fact;
- **Storage deletion is not available to ordinary members.** Object removal belongs to the trusted rejection, retention and cleanup flows (§14, §23, §24), which run with system authority.

**On the specific upload mechanism.** If the chosen Supabase mechanism is a signed upload target rather than ordinary authenticated `INSERT`/`UPDATE` on `storage.objects`, the invariants above are unchanged — but **do not assume the mechanism enforces them**. Which of these a signed upload target guarantees (single path, single use, no overwrite, expiry) must be **verified in the target environment**, and anything it does not enforce must be enforced elsewhere: by the Storage policy, by the preallocation state, or by finalize refusing an object that does not match what was authorized. Finalize-time validation (§14) remains required regardless, because it is the one check whose behaviour is fully ours.

---

## 7. Private Media Access

**The authorization boundary for media is Storage RLS — not the application.** An earlier draft said every media read is "mediated" by the server, which overstated it and would have been the same category of mistake as claiming UI hiding is authorization. Architecture §7 relies on Storage RLS mirroring table RLS, and this document does not invent a third model.

The accurate picture:

1. **Private buckets are protected by Storage RLS.** For batch media that means deriving the batch from the first path segment (§6) **and consulting the object's database state** (§7.1); avatars are authorized separately (§6.1).
2. **A member who calls the authenticated Storage API directly and satisfies the same Storage RLS policy is not bypassing anything.** They are exercising exactly the access the policy already grants. The only thing they skip is our convenience layer.
3. **The application normally mints short-lived signed URLs** — for delivery and UI convenience, and because it is the natural way to hand an `<img>` tag something it can fetch. That is a *delivery mechanism*, not the boundary, and it is **not something only our server can do** (§8.1).

This matters because the alternative framing invites a dangerous design. If direct authenticated Storage reads were prohibited, then signed URLs would have to be minted by something holding authority the user does not — and **service-role authorization would quietly become the primary boundary for all media**, replacing a database-enforced rule with an application-enforced one. That is a strictly worse position, and it is not what architecture §7 specifies.

### 7.1 Membership is necessary but not sufficient

An earlier draft said active batch membership *is* the privacy guarantee for authenticated object access. That is wrong in a way that matters: it would let a batch member **bypass table-level visibility by going straight to Storage with a known object path**.

Every visibility rule the table policies enforce — soft deletion, moderation removal, and later capsule locks — lives in the *database*, not in the object path. A policy that checks only "is this caller in batch X" would happily serve the bytes of a memory that was deleted an hour ago, or one still sealed in a time capsule. The row would be invisible; the photograph would not be.

**So Storage `SELECT` on batch media must reflect the media and memory state, not just membership:**

**`ready` media** — readable only when *all* of:

- the caller is an **active member** of the object's batch;
- the batch is **not soft-deleted**;
- `media_assets.deleted_at IS NULL`;
- the referenced **memory exists and is visible** to that caller;
- `memories.deleted_at IS NULL`;
- *(when time capsules ship)* the memory's **`locked_until` predicate has passed** — a sealed capsule's images must not be downloadable by path before unlock, or the feature's entire promise is decorative (§5.5, database.md §22).

**`pending` media** — readable **only by its uploader**, and only where the upload/finalize flow genuinely requires a read. It is not part of the archive yet and is not readable by ordinary batch members.

**`rejected` media** — **never generally readable.** It exists only transiently, while cleanup removes the object (§14). Content that failed validation must never be servable.

**The rule in one line:** *a soft-deleted, moderated-away, or locked memory's bytes must not remain directly downloadable merely because the caller is still an active member of the batch.* Deletion that hides the row but leaves the image fetchable is not deletion.

This makes the Storage policy more than a membership check — it has to reach the `media_assets` row and, through it, the memory. That is more work than a path-prefix comparison, and it is the price of Storage and tables agreeing about what is visible. Where they disagree, Storage is the weaker link and becomes the one an attacker uses.

Remaining rules:

- Signed URLs are **never** persisted in the database, stored in a shared cache, logged, or embedded in a page a shared cache could store (§21, architecture §11).
- The Next.js image optimizer must not be handed a rotating signed URL as a cache key; whichever resolution architecture §9 takes, the constraint is absolute: **a cached media response must never outlive the viewer's authorization**. If the resolution is an application media route, that route is a new authorization surface and gets the full §5 treatment plus `Cache-Control: private, no-store`.
- Storage policies get the same adversarial negative testing as table policies (§5.6), **calling Storage directly by path**. Beyond the obvious non-member, pending-requester and removed-member cases, the tests that matter most are the ones where the caller *is* a legitimate active member:
  - an active member fetches the object of a **soft-deleted or moderator-removed memory** — must fail;
  - an active member fetches an object whose **`media_assets.deleted_at`** is set — must fail;
  - an active member fetches a **`pending` object uploaded by someone else**, and a **`rejected`** object — must fail;
  - a member fetches an object in a **soft-deleted batch** — must fail;
  - *(post-MVP)* a member fetches an object belonging to a **sealed, not-yet-unlocked** memory — must fail;
  - a member attempts to **upload to a path they did not preallocate**, to another member's pending media id, or **over an existing `ready` object** — must fail (§6.2);
  - a member attempts to **delete a Storage object** directly — must fail;
  - a user fetches **another user's avatar** with whom they share no active batch — must fail (§6.1).

---

## 8. Signed URL Policy

| Property | Policy |
|---|---|
| Lifetime | **Short — minutes, not hours or days.** Long enough to load a gallery, not long enough to circulate |
| Scope | **One object.** Not one viewer, not one request — see below |
| Minting | Performed by the application after confirming active membership — but **not exclusively by the application**; see §8.1 |
| Persistence | Never stored in the database, a cookie, a log, or a shared cache |
| Sharing | Treated as a leak; the TTL is what bounds the damage — for URLs the application minted (§8.1) |

**What a signed URL actually is.** It is a **bearer capability for a single object, valid until it expires, and transferable to anyone**. It is minted only after a viewer has been authorized, but Storage does not thereafter know or check *who* is using it. It is therefore:

- **not viewer-bound** — anyone who obtains the URL can fetch the object;
- **not one-request-only** — it can be replayed until expiry;
- **not inherently single-use** — nothing decrements or invalidates it on first use.

An earlier draft described it as scoped to "one viewer, one request", which is wrong in a way that would justify unsafe decisions later — such as treating a signed URL as safe to log, put in a redirect chain, or hand to a third-party service.

**The honest limitation, unchanged.** Because Storage validates the signature without consulting membership, a minted URL **cannot be revoked**. When a member is removed, their database and Storage access stop immediately, but any URL already in their possession keeps working until it expires. This is why the TTL must be short rather than convenient, and it is why "removal is immediate" needs this footnote everywhere it appears. If true instant revocation is ever required, the answer is to stop handing out direct Storage URLs and serve media through an authorizing application route — contained within the `media` module (architecture §17).

**If a link must genuinely be single-use** — the export case is the likely one (§25) — an ordinary Storage signed URL will not deliver that. Single use requires **application-controlled state**: an opaque token the application issues, records, validates and marks consumed, with the underlying object fetched server-side only after that check. Assuming signed-URL semantics provide it would be a silent failure.

### 8.1 Who can mint a signed URL

An earlier draft said signed URLs are minted "server-side only". That does not follow from the Supabase Storage authorization model and should not be relied upon.

**Creating a signed URL requires `SELECT` permission on `storage.objects` for that object** — the same permission an ordinary authenticated read requires. So an authenticated member who already satisfies the Storage RLS `SELECT` policy for an object (§7) **can call the signed-URL API themselves**. Nothing in the current model prevents it, and a security property that assumes otherwise is assuming a restriction that was never configured.

**The model this document adopts (Option B):**

1. **A client-created signed URL is not a privacy bypass.** Creating it required passing exactly the same Storage RLS `SELECT` check that reading the object requires. A member who mints a URL for a photo in their own batch has obtained nothing they were not already entitled to. The boundary held; it was simply exercised directly rather than through our convenience layer (§7).
2. **Application-level rate limits on signed-URL minting are therefore not a complete security control.** They are a useful throttle on the *application's* path and worth keeping (§17), but they can be sidestepped by a member calling Storage directly. They must not be counted as the defence against bulk URL harvesting — the honest position is that a member can enumerate and mint URLs for content they can already see, and the mitigations that actually bite are short TTLs plus the fact that they already have read access anyway.
3. **Short TTLs remain important for URLs the application creates**, because those are the ones that end up in pages, caches, history and shared screenshots (§8, §21). But the guarantee is bounded accordingly: **an application-enforced TTL binds only URLs the application mints.** A member who calls the signed-URL API directly chooses their own expiry, so unless the provider can independently enforce a *maximum* expiry on the bucket, our TTL policy does not globally bound every URL an authorized member could create. Do not state or design as though it does.

   This is **not a new privacy boundary being lost.** An authorized member can already download the bytes; a long-lived URL they minted for content they can read is another form of the copy they were always able to keep. It belongs to the inherent "authorized members can retain copies" limitation (§25 item 7), not to the list of things access control is expected to prevent. It matters only for accuracy — so that no control is credited with a reach it does not have.
4. **We do not introduce service-role media authorization to force server-only minting.** Doing so would replace a database-enforced boundary with an application-enforced one for all media — the same trap §7 describes. Preventing a member from minting a URL for content they can already read is not worth that trade.

**If server-only minting is ever genuinely required (Option A)**, it depends on Storage policies being able to reliably distinguish signed-URL creation from an ordinary object read in the deployed environment. That distinction must not be assumed: it has to be **explicitly configured and proven by test** — a member attempting to create a signed URL directly must be refused while their ordinary read still succeeds — before any security property is allowed to rest on it. Until such a test exists and passes, Option B is the operative model.

---

## 9. Invite-Link Security

An invite is a **bearer credential shared through channels we do not control** — WhatsApp, screenshots, QR codes (ADR-08b). The design assumes it will leak eventually.

| Control | Requirement |
|---|---|
| Entropy | ≥ 256 bits from a CSPRNG. Never sequential, never derived from batch id or time |
| At rest | **Only a SHA-256 hash is stored.** The raw token never touches the database, logs, or telemetry |
| Lookup | By hash. A fast digest is correct here — the token is already high-entropy, so there is no low-entropy secret needing a slow KDF |
| Readability | **`token_hash` is not selectable by any client role** (column privilege, §5.1). An admin managing invites sees the list, never the hashes. This blocks an admin of one batch from exfiltrating hashes for offline work, and shrinks what an over-broad `SELECT` could ever return |
| Privilege | **Member only.** No invite can confer moderator, admin or owner — there is no column for it (database.md §3.4) |
| Expiry / caps | `expires_at`, `max_uses`, `revoked_at`, all evaluated as a computed predicate at redemption time. **The schema permits `expires_at` to be NULL** (database.md §3.4), so expiry is *supported and controllable*, not currently mandatory. **A finite default expiry is a security recommendation awaiting explicit product confirmation** — a never-expiring link in a group chat is a permanent way in. Revocation and use caps are unaffected and remain available regardless |
| Revocation | admin+ can revoke instantly; revocation is effective on the next redemption attempt with no cache in between |
| Retention | Rows are retained for the life of the batch, so provenance survives; retention never implies usability (database.md §3.4) |
| Rate limiting | Redemption is rate-limited per IP and per account — it is the one unauthenticated-until-valid endpoint (§17) |
| Enumeration | An invalid, expired or revoked token returns **one generic response**. It must not reveal whether the token ever existed, or which batch it belonged to |
| URL handling | **The raw token must never reach the server in a logged position** — see §9.1 |
| Landing page | Shows the **batch name only**, and only after the token validates. No member list, no member count, no media, no description — a valid token is an invitation to join, not a preview of the archive |

### 9.1 Keeping the raw token out of logs

There is a direct conflict between two rules already in this document: the token is a **bearer credential** (§9) and raw tokens are **never logged** (§21). A token placed in a URL **path or query string** breaks the second rule automatically, and `Referrer-Policy: no-referrer` does not fix it — that header only suppresses the `Referer` sent to *third parties*. The token still lands in:

- the hosting platform's request logs (Vercel), and any reverse proxy or CDN in front of them;
- browser history and session restore;
- error-reporting and analytics tooling that captures URLs;
- anything the recipient copies, screenshots, or pastes into a chat.

Some of these are outside our control and outside our retention policy. A credential sitting in a platform access log is a credential we cannot promise to delete.

**Required design — the token travels in the URL fragment.**

```
https://…/invite#<token>
```

The fragment is **not sent in the HTTP request**, so it never appears in server, proxy or CDN logs. The client reads it, then **POSTs it to the validation/redemption endpoint** — a request whose body is excluded from logging and from error-reporting capture (§21). After validation, the client **replaces the visible URL** so the raw token is no longer in the address bar or added to history.

**An acceptable alternative** is any design that provides equivalent guarantees: platform/access-log redaction that is actually verified end to end, combined with **immediately exchanging the raw token for a short-lived opaque state handle** so the raw value has the narrowest possible lifetime. The exchange is the important half — after it, nothing downstream handles the credential.

**What is not acceptable:** a raw token in a path or query string on the assumption that `no-referrer` covers it. That header solves a different problem.

Two consequences to carry through implementation: the redemption endpoint accepts the token by **POST body only**, never as a query parameter; and error reports, breadcrumbs and analytics on the invite route must be verified not to capture the full URL before it is cleaned.

**Redemption never bypasses the join policy.** Where the batch requires approval, redemption produces a `pending` row with no access (§10).

**A removed member who redeems a fresh link does not silently rejoin.** Their `batch_members` row already exists with `status = 'removed'`; redemption must not flip it back to `active`. Re-entry requires an explicit approval decision by mod+, which is also what makes removal meaningful.

---

## 10. Join-Request Security

- A pending row conveys **zero** access — no gallery, no member list, no memory, no comment, no media (A3).
- A pending requester can see **only their own membership row**, so they know the request is outstanding without learning the roster.
- **Only mod+ may approve or reject**, and never their own request.
- Approval and rejection are audit-logged with the deciding actor (§20).
- **Batches are not discoverable.** There is no search, no directory, and no endpoint that confirms a batch exists from its id. Entry is by link only, so a stranger cannot generate join requests against batches they have not been given.
- Repeat request spam is bounded by the one-row-per-person constraint plus rate limiting.
- A rejected requester cannot escalate by re-requesting in a loop; re-requesting reuses the same row, and the rejection history lives in the audit log (database.md §1.3).

---

## 11. Owner / Admin Privilege Boundaries

1. **The actor's role is resolved from `batch_members`; the requested target role is an input.** The earlier phrasing — "a `role` field in a request body is ignored" — was too broad, since promoting someone to moderator obviously requires naming the role being granted. The distinction that matters:

   | Input | Status |
   |---|---|
   | The **requested target role**, from a strict allowlist | **Accepted.** This is the operation's parameter |
   | The **target member**, identified by id | **Accepted**, then resolved and validated |
   | The **caller's own role**, or any claim about their authority | **Never accepted.** Always resolved from `batch_members` |

   The privileged RPC (§5.2.2) therefore: resolves the actor's real role from `batch_members` using `auth.uid()`; validates the target's current role and membership status; enforces the hierarchy and ceiling rules (§4, and rule 2 below); and only then assigns the requested role. A caller can ask for an outcome; they can never assert the authority to grant it.

   **Membership moderation works the same way — as narrow actions, not free-form status writes.** The operations are `approve`, `reject` and `remove`, each with its own validation of the legal transition from the target's current status. The caller does not supply a `membership_status` value for the database to store; an arbitrary caller-written status would let a member skip the approval queue by declaring themselves `active`.
2. **An actor may only assign roles strictly below their own authority** (§4 rule 2), and only through the RPC-only role-change path (§5.2).
3. **No self-escalation, and no arbitrary self-demotion.** For any ordinary role change the actor and target must differ.
4. **Rank ceilings are enforced on the target as well as the actor** (§4). A moderator acting on an admin fails at Layer 2 *and* Layer 3.
5. **At most one active owner per batch**, structurally guaranteed by a partial unique index. A buggy transfer that forgets to demote fails loudly on the constraint instead of quietly creating two owners.

**Ownership transfer is the one sanctioned exception to "no self-role-change".**

The rule in §4 forbids changing your own role, but a transfer necessarily changes the outgoing owner's role — the exactly-one-owner constraint guarantees it, since the new owner cannot be promoted while the old one still holds the role. Rather than leave that as an apparent contradiction, it is named:

- **General self-role changes remain forbidden.** No one may promote or demote themselves, and an owner may **not** simply demote themselves to admin as a standalone action — that is the move that produces an ownerless batch (§32, B3).
- **Ownership transfer is a dedicated atomic operation.** The owner authorizes transfer to a **named, currently active member** of the same batch. Their own demotion to admin happens **as a consequence of that transaction**, not as an independently requestable change.
- Both role changes commit together or neither does, and the transaction writes an `ownership_transferred` audit record naming both parties.
- Because it is irreversible in practice and hands over the batch, transfer is a candidate for re-authentication alongside batch deletion (§2, §24).
6. **Only the owner may delete the batch** (§24) — the single most destructive action in the product.
7. **Admins cannot remove or demote the owner**, so a compromised admin account cannot seize a batch.
8. **Every privileged action is audit-logged with the actor's role frozen at the time of the action** (§20).

**Known structural gap.** Postgres can enforce *at most* one owner but not *at least* one (database.md Q3). A batch can, in principle, reach zero owners — most plausibly through owner account deletion. Security consequence: a batch with no owner cannot transfer ownership or be deleted, and if its admins also leave it becomes unmoderatable. This is listed as a blocker in §32.

---

## 12. Service-Role Key Protection

The service-role key bypasses RLS entirely. Exposure is not a degradation, it is **total loss of every guarantee in this document**.

| Control | Requirement |
|---|---|
| Naming | **Never** prefixed `NEXT_PUBLIC_`. Enforced by the validated env module splitting server and client schemas (architecture §15) |
| Module isolation | Lives in one server-only module. Importing it into anything reachable from the browser bundle must fail the build, not merely be discouraged |
| Call-site allowlist | A short, enumerated, reviewed list — see below. Adding one is a reviewed change, not a convenience |
| Logging | Never logged, never in an error message, never in telemetry, never in a stack frame's captured locals |
| Environments | Distinct keys per environment; preview deployments never hold the production key |
| Rotation | Assumed and rehearsed. Nothing durable (no stored URL, no client bundle) embeds it, so rotation breaks nothing |
| CI | A build-time check that the key does not appear in any client artifact |

**"Privileged" is not a reason to use the service role.**

This is the distinction that keeps the allowlist short. A user-initiated action being *privileged* — a role change, a member removal, an ownership transfer, resolving a report, editing batch settings — does **not** mean it needs system authority. Those actions are performed **by a user**, on rows **within a batch that user belongs to**, and the correct implementation is user-scoped execution calling a narrow privileged SQL function that authorizes `auth.uid()` (§5.2.2).

**The difference between that and the service role is real, and it is worth being precise about.** Both involve elevated database rights, so it would be easy to conclude they are equivalent. They are not:

| | Privileged RPC (§5.2.2) | Service-role client |
|---|---|---|
| Caller identity | Preserved — the function reads `auth.uid()` and authorizes it | **Discarded.** The database sees the system, not a person |
| Scope of elevation | One operation, one function, fixed logic | Every table, every row, every statement |
| Blast radius of a bug | That operation | The entire database |
| Attributability | Inherent — the actor is known and audit-logged | Only if the application remembers to record it |

So the privileged-RPC path keeps the caller's identity as the input to an authorization decision made **inside the database**, while the service-role path removes the caller from the picture entirely and relies on the application having checked first. Note the honest consequence, per §5.2.2: within a definer RPC, RLS is not what authorizes the write — the function's own checks are. The advantage over the service role is not that policies still run; it is that the trusted logic is small, fixed, reviewable, and identity-aware.

Reaching for the service role in these flows would be actively harmful: it discards the caller's identity at the database boundary, turns an authorization bug into a full-table exposure, and grows the very call-site list that makes the key auditable.

**Legitimate service-role call sites in MVP** — operations that genuinely require *system* authority:

1. **Supabase Auth admin operations that cannot be performed as the user.** Specifically, **account deletion** requires the Auth admin API to delete the `auth.users` record; a user cannot delete their own auth record through the ordinary client. This is the clearest legitimate case (§22).
2. **Bounded cron and cleanup jobs** acting on rows across all batches with no user in the request: orphaned and rejected upload purging, retention reaping, invite retirement (architecture §13).
3. **Operational backup, export and recovery tooling** run outside the request path by named operators (§26).

**Deliberately removed from this list:** "ownership resolution", which appeared in an earlier draft and does not belong — ownership transfer is a user-initiated action inside one batch and is performed by the owner through the transfer function (§11), not by the system. The only ownership-adjacent case that could need system authority is resolving a batch left ownerless by account deletion, which is a subcase of (1) and should be designed as part of the B3 decision (§32), not assumed into the allowlist now.

Each remaining call site acts **as the system, not as a user**, and each writes an audit record where a user-visible effect results.

**The dependency corollary:** any package in the server runtime can read this key. That is a direct argument for a small server-side dependency surface (§30).

---

## 13. Input Validation

- **Validate at every boundary**, with a schema, before any use. Server Actions, Route Handlers, webhooks, cron endpoints.
- **Order is fixed**: authenticate → validate → authorize → execute (architecture §18). Validation before authorization means an authorization check never runs on a malformed value.
- **Allowlist, never denylist.** Unknown fields are rejected, not ignored — silently dropping an unexpected field hides both bugs and probing.
- **Length and range caps mirror the database CHECKs**, so the two cannot drift and a rejection happens early with a good message rather than late with a constraint violation.
- **UUIDs are validated as UUIDs** before they reach a query.
- **Never trusted from the client**: user identity, the caller's own role, membership status, batch ownership claims, storage paths, `use_count`, and **system timestamps** (see below).

**Three clarifications, because the blanket version of that rule was too broad:**

**"Never trusted" is not the same as "never present in the payload".** An insert can technically carry an author or profile id **only if the database independently requires it to equal `auth.uid()`** — in which case the value is a claim the database re-derives and rejects on mismatch, not an authoritative input. The preferable design is to default the column from `auth.uid()` so the caller cannot supply it at all (§5.4.1). What is forbidden is treating any client-supplied identity value as authoritative; the distinction is whether the database would notice a lie.

**Report targets — the client identifies, the server resolves.** A user obviously has to be able to say *what* they are reporting, so the client **may** submit a target reference: which memory, comment or member. What the client must never do is supply the stored snapshot verbatim. The RPC (§5.2) takes the submitted reference, **resolves it against the database**, confirms it exists, is of the declared kind, and belongs to a batch the caller is actively in — and then derives the immutable `target_kind` / `target_id` snapshot **from the resolved row**. The invariant is *derived, never copied*: a caller can nominate a target, but cannot dictate what the permanent record says was reported.

**Timestamps split into two categories, and only one is server-controlled:**

| Category | Examples | Rule |
|---|---|---|
| **System timestamps** — establish ordering, validity or accountability | `created_at`, `updated_at`, `joined_at`, `requested_at`, `decided_at`, `resolved_at`, `deleted_at`, `expires_at`, `revoked_at`, `sealed_at`, `locked_until`, audit `occurred_at` | **Server-controlled.** Never accepted from a caller — a client-set `expires_at` extends its own credential, and a client-set audit time forges history |
| **Content timestamps** — describe the world, not the system | **`memories.occurred_on`** | **User-supplied by design.** It is the event date of the memory — the thing the archive is chronologically organised around (database.md §3.5). Validated against the schema and sensible bounds, not generated by the server |

`occurred_on` is deliberately **not** a security timestamp. Treating it as one would break the product: a photo from 2019 uploaded in 2026 belongs in 2019, and only the person uploading it knows that. It is content, subject to ordinary content validation, and the schema's `NOT NULL` requirement is met by the application defaulting to the upload date when the user offers nothing.
- **Redirect targets are allowlisted** — the auth callback and post-redemption redirect must not accept arbitrary URLs (open-redirect → credential phishing).
- Cron routes verify their shared secret and webhooks verify their signature **before parsing the body** (architecture §18.9).

---

## 14. File Upload Validation

Two-phase upload (architecture §8), with validation at both ends and trust at neither:

**At upload-request time** — the client-declared type and size are checked against policy. This is a **gate, not a guarantee**: it rejects honest mistakes early. Whether the issued upload target *itself* constrains type or size depends on the provider mechanism — **only claim that constraint where the specific Supabase upload mechanism actually enforces it**, and verify it rather than assuming. Regardless of the answer, **finalize-time size validation is required**. The declared value is discarded, never persisted (database.md §3.6).

**At finalize** — the server reads back from Storage:

| Checked | Strength |
|---|---|
| Object exists at the path the server issued | **Authoritative** |
| **Actual stored byte size** | **Authoritative — the strong fact in MVP.** It is a property of the stored object and cannot be misreported |
| Content-Type metadata Storage reports for the object | **Metadata enforcement only** — see below |
| Duration, codec, container internals | **Not checked.** Client-side hints only |

**How far the content-type check actually goes.** The server reads this value rather than accepting it in the finalize request, which is better than trusting a request body. But it is **object metadata, and that metadata may ultimately originate from caller-controlled upload headers**. So it must not be described as proof of anything about the file.

In particular, **the MVP cannot reliably detect that a user declared JPEG and uploaded an MP4.** Establishing that requires reading the bytes, which the MVP does not do. An earlier draft implied otherwise; it does not hold.

What the content-type allowlist *is* good for: it enforces a consistent, constrained metadata surface, it keeps disallowed types out of the system as a matter of record, and it determines the headers the object will later be served with. That is metadata enforcement, and it is worth having — it is simply not content sniffing, and no downstream decision should assume it is.

Proving intrinsic properties requires a trusted media-inspection step (`ffprobe`-class), which is real infrastructure and explicitly **out of MVP scope** (ADR-08a).

**Security consequences accepted, with mitigations:**

- **A stored object may not be what its metadata says.** The defence is not detection but **safe handling**: media is served from a separate origin with strict response headers and is never executed or rendered as a document (§9 of this list, and §15). Combined with the SVG exclusion, the realistic outcome of a mismatched file is a broken image, not code execution.
- **The hard size cap is the meaningful enforcement**, since it is the one authoritative byte-level fact and the duration cap is advisory.
- **Rejected uploads have their bytes deleted** by the finalize path, retried idempotently by the sweep. Untrusted content never accumulates in a private bucket.
- Original filenames are stored as display metadata only, length-capped, and rendered as text — never used in a path, a header, or a shell.

---

## 15. Allowed Media Types

Strict allowlist. Anything not listed is rejected.

**Images:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`

**Video:** `video/mp4` only (H.264 + AAC — the combination that plays natively without transcoding, architecture §10)

**Explicitly excluded, with reasons:**

| Type | Why |
|---|---|
| **`image/svg+xml`** | **An SVG is a script container.** Served inline from our origin it is a stored-XSS vector against every member of the batch. Excluded outright — not sanitised, not sandboxed, not accepted |
| `text/html`, any document or archive format | Not media; an inline-rendering and exfiltration risk |
| `image/heic` / `image/heif` | Not a security exclusion but a correctness one: browsers will not render it and the MVP does not transcode, so it would store unviewable memories. This is a real friction point for iPhone users and needs a product answer (§32, Risk 6) |
| Any `application/*` | No legitimate use |

**Serving rules that make the allowlist meaningful.** Because the type allowlist is metadata enforcement rather than content inspection (§14), the response headers are doing most of the actual work:

- Media is served with its stored content type plus **`X-Content-Type-Options: nosniff`**, so a browser cannot reinterpret a mislabelled object as something executable.
- Anything that could render as a document is served **`Content-Disposition: attachment`**.
- Media is **not served from the application's own origin** in a way that would let it inherit the app's cookies or DOM — a separate origin means even a hostile file cannot reach a member's session.

**These headers must be verified against the actual Storage response, not assumed.** If media is fetched directly from Supabase Storage via a signed URL (§7, §8), the bytes are served **by the Storage origin** — Next.js middleware, `next.config` headers and the application's CSP have **no effect on that response**. Whatever headers Storage attaches are the headers the browser sees.

So this is an explicit pre-launch verification item: confirm what Supabase Storage actually returns for each allowed type — content type, `nosniff`, and disposition. **If the provider cannot guarantee the required headers, the media-delivery design must compensate before launch** — for example by serving media through an application route that sets them (accepting the authorization-surface and caching consequences in §7), or by restricting the allowlist to types that are inert regardless of how they are served. What is not acceptable is shipping on the assumption that application-level header configuration governs bytes served from another origin.

---

## 16. File-Size Limits

- **A per-file cap for images and a separate, larger cap for short videos.** Exact figures are a product/ops decision; the security requirement is that both exist and that the **server enforces them from the actual stored size**, not the declared one.
- Enforced at up to three points: a client-side hint (UX), a constraint on the issued upload target **where the provider mechanism actually enforces it** (verify; do not assume), and — **always, regardless of the other two** — the authoritative check at finalize against the actual stored size.
- **Over-cap uploads are rejected and their bytes deleted** — an oversized object must not survive its own rejection.
- **Per-batch and per-member quotas are not implemented in MVP.** The residual risk is a member filling a batch's storage; it is bounded by per-file caps and rate limiting (§17), visible in ordinary billing/monitoring, and socially self-limiting in a closed group of classmates. Worth revisiting if abuse appears.
- Request-body limits on Server Actions remain low, since media never proxies through the application.

---

## 17. Rate Limiting

| Surface | Why | Key |
|---|---|---|
| **Invite redemption** | Token brute force, batch probing | IP **and** account |
| Sign-in / sign-up / magic link | Credential stuffing, account enumeration, email bombing | IP + identifier |
| Upload-target issuance | Storage exhaustion, cost abuse | Account |
| Signed-URL minting *(application path only)* | Throttles bulk URL harvesting through our endpoints. **Not a complete control** — a member with Storage `SELECT` can mint directly (§8.1) | Account |
| Comment / reaction writes | Spam, notification abuse later | Account |
| Report filing | Moderation-queue flooding | Account (plus the dedup index) |
| Export | Bulk exfiltration pacing | Account |

Notes: Supabase applies its own limits to auth endpoints, but **invite redemption is our endpoint and needs our limit** — it is the highest-value guessing target in the product. Limits are enforced server-side; failures return a generic response that does not distinguish "wrong token" from "too many attempts", or an attacker can use the difference as an oracle.

---

## 18. Abuse Reporting

- Any active member may report a memory, a comment, or another member (PRD §17).
- **Reporter identity is never disclosed to the reported party.** Reports are readable by mod+ only; the target cannot see that a report exists, who filed it, or what it said (§5.3). Without this, reporting a well-connected classmate is socially unsafe and the feature goes unused.
- **Self-reporting is permitted by design** and treated as a takedown request (PRD §16).
- Duplicate open reports from one reporter about one target are suppressed by a unique index on the immutable snapshot, so the queue cannot be flooded and a real report cannot be buried.
- Reports survive their target's deletion via the snapshot, so a moderator can still see what was reported after content is removed — and **a report never blocks deletion**, so being reported cannot be used to make content or an account undeletable (database.md §3.9).
- Reports are batch-scoped like everything else: no cross-batch queue, no global moderation view.

---

## 19. Moderation

- **Moderation is batch-internal.** Each batch polices itself; there is no cross-batch or public moderation surface, consistent with a private product.
- Moderators may remove content and manage membership up to their ceiling (§4); they may not change roles, alter batch settings, or read the audit log.
- **Removal is a soft delete** — hidden immediately from every read path, recoverable within the retention window, with the bytes reaped afterwards (§23).
- Every moderation action is audit-logged with actor, target and time (§20).
- Removed content is invisible to ordinary members immediately; there is no "removed" tombstone that re-exposes the content it is hiding.

**Structural gap.** There is **no platform-level moderation capability in MVP**. If the abuser is the batch owner, no one inside the batch outranks them, and no operator tooling exists to intervene. For illegal content or a hostile owner, the only lever is direct service-role database access — which is not a process, and is not auditable as one. Flagged in §32.

---

## 20. Audit Logs

- **Scope: privileged and contested actions only** — role changes, ownership transfer, member approval/rejection/removal, content removal and restoration, invite creation and revocation, report resolution, batch settings changes, batch deletion and restoration. Not a change log of every write.
- **Written in the same transaction as the action**, by the SQL function performing it. If the action commits, the record commits; if it rolls back, so does the record.
- **Append-only enforced by privilege**, not by trigger: no client role holds `UPDATE` or `DELETE`.
- **Historical facts are frozen** — `actor_role` stores the role held *at the time*, and target references carry no FK so the record survives its subject's deletion.
- **Readable by admin+ of that batch only.**
- Contains identifiers and action metadata, never content (§21).

**Weakness worth naming:** `actor_profile_id` is `ON DELETE SET NULL`, so if an actor deletes their account the audit trail keeps the action but loses the actor — precisely the person most motivated to delete their account after misbehaving. The action, timing and frozen role survive; the identity does not (§32, Risk 5).

---

## 21. Sensitive Logging Rules

**Never logged, in any environment, at any level:**

- Media bytes; signed URLs; storage paths of private objects
- Raw invite tokens **and** their hashes
- Access tokens, refresh tokens, session cookies, JWTs
- The service-role key or any secret
- Caption text, comment bodies, batch descriptions, profile bios
- Email addresses in message bodies
- Full request bodies on content-carrying endpoints

**Logged instead:** request id, user id, batch id, action name, outcome, duration, error class. Identifiers, not content.

**The standard to hold:** *a person's memories must not be reconstructable from logs, and neither must their access.* Logs have a different, usually longer-lived, and much broader access profile than the database — everything RLS protects is unprotected the moment it is written to a log line.

**Error reporting:** Sentry (or equivalent) with PII scrubbing on, request bodies off, and breadcrumbs reviewed for content leakage. Client-side error reporting must not capture DOM contents of pages showing batch media. User-facing errors stay generic with a correlation id; authorization failures in particular never disclose whether a private resource exists (§3).

---

## 22. Account Deletion

- Deletion of the auth user cascades to `profiles`.
- **Content is retained with attribution nulled.** Authorship FKs are `ON DELETE SET NULL`, so memories, comments and media remain in the batch archive and render as "former member". This is deliberate: PRD §16 requires that one person leaving cannot tear holes in a shared twenty-year record (database.md §12).
- **Memberships and reactions cascade away** — they are *about* the person in a way a photograph is not.
- **Reports and audit rows survive** with reporter/actor nulled; the report's snapshot preserves what was reported.
- **Blocked or resolved first if the account owns a batch** — see the Q3 gap (§11, §32).
- Storage objects the person uploaded remain, because the memories remain.

**Privacy tension, stated openly.** "Delete my account" does not mean "delete everything I ever contributed", because contributions are shared batch history. This is a defensible product position but it is a **user-facing promise that must be worded honestly at deletion time** — and it is a live question wherever data-protection law grants a right to erasure. Legal review belongs before launch, not after (§32, Risk 4).

---

## 23. Memory Deletion

- **Who:** mod+ of the batch always; **the author only if PRD unresolved decision #7 permits author self-delete** (including any time limit it sets). The Prompt 11 audit flagged that an earlier draft of this line asserted author self-delete as settled while PRD #7 still leaves "whether a Member can edit or delete their own uploaded memory, and any time limits" open — that decision is **not** made here. Whichever way #7 resolves, the deletion fields are never client-writable: author self-delete, if permitted, runs through the controlled write path in §5.4.3.
- **How:** soft delete. Hidden from every read path immediately (§5.1), recoverable within the retention window, then hard-deleted with **Storage objects removed before the row**, so the pointer is never lost while the bytes remain (database.md §24).
- **Audited** when performed by a moderator, since that is a contested action.
- **Residual exposure:** a signed URL minted just before deletion remains valid until it expires (§8). Short TTLs bound this for application-minted URLs; a member who minted their own could hold it longer (§8.1) — part of the inherent limit that a member who could already see the memory may have kept a copy.

---

## 24. Batch Deletion

The most destructive action in the product — an entire shared archive.

- **Owner only.** Not admins, not moderators.
- **High friction:** explicit confirmation naming the batch. **Re-authentication is recommended** before it proceeds, given no MFA exists (§2).
- **Soft delete with a long grace period.** During it, all content is invisible to everyone (the membership predicate requires a non-deleted batch), and the deletion is reversible.
- **Audited**, and the audit row is written before the deletion completes.
- **Consequence to accept:** after hard deletion, surviving audit rows have a null `batch_id` and fall outside every batch-scoped policy — reachable only via service role (database.md Q7).

**Hard deletion is object-first and strictly ordered.**

The database rows are the *only* record of where a batch's Storage objects live: `storage_path` exists on `media_assets`, and `media_assets` cascades from `batches`. A database cascade run first therefore destroys the pointers to objects that still exist, leaving private media permanently stranded in a bucket with no row referencing it, no way to enumerate it, and no way to delete it. That is both an unbounded storage leak and a **privacy failure** — orphaned private bytes that outlive the batch that was deleted precisely to remove them.

The required order, matching database.md §24:

1. **Enumerate** the batch's `media_assets` rows *while `storage_path` still exists*, in bounded pages.
2. **Delete the Storage objects**, or confirm each is already absent.
3. **Only then** hard-delete the batch row and let the database subtree cascade.

**The operation must be idempotent and retryable.** It spans two systems and can fail partway: deleting an already-absent object is a no-op, re-enumeration after a partial run simply finds fewer objects, and a retry that reaches step 3 twice is harmless. A failure between steps 2 and 3 leaves the batch soft-deleted with objects gone — invisible to users, and resolved by the next run. A failure *inside* step 2 leaves rows intact, which is the recoverable direction and the reason the order is what it is.

Never the reverse: cascade first is unrecoverable, because the information needed to clean up is exactly what the cascade destroys.

---

## 25. Data Export

**Export scope is an open product decision, not settled here.** database.md **Q9** explicitly leaves scope and format unresolved, and the PRD places export tooling post-MVP (§15, §18). An earlier draft of this section quietly fixed the policy — a member-level export of everything they can see, and an admin+ whole-batch export. Neither is established by any source-of-truth document, and a security document is the wrong place to decide product scope by implication. **Q9 stays open.**

What this section fixes instead is the set of **security invariants any eventual export design must satisfy**:

1. **Export can never reveal data outside the caller's authorized batch scope.** It is a different presentation of an existing read, never a new authorization path. If a design requires elevated access to assemble the output, that is a redesign signal, not an implementation detail.
2. **Scope must be explicitly decided before implementation** — who may export, what it contains, and at what granularity. Building the mechanism first and deciding scope later is how an export endpoint becomes accidentally over-broad.
3. **Bulk or whole-batch export requires a deliberately privileged policy**, decided as part of (2). It must not fall out as a side effect of a member-level feature.
4. **Hard exclusions, regardless of scope:** `batch_invites.token_hash` — **credential-derived security data**, not itself a redeemable credential (the raw token is the bearer credential and is never stored; the SHA-256 digest cannot be redeemed without a preimage, §9). It is excluded because exporting the verifier for a live access-control mechanism serves no member purpose and needlessly widens where that material exists. Also excluded: audit and moderation records in any member-facing export (they contain decisions about other people), and anything from `auth.users` beyond the requester's own identity.
5. **Rate-limited and audit-logged.** Bulk export is the cleanest exfiltration primitive a legitimate member has; it should be paced and it should leave a trace.
6. **Delivery is scoped to the requester and short-lived — never a public URL.** If it must be genuinely single-use, that requires application-controlled token state; an ordinary Storage signed URL does **not** provide single use (§8).
7. **Inherent limit, worth stating plainly:** any member can already see their batch's content, so export cannot prevent a member taking a copy. It can make that act paced, visible and attributable. That is the achievable goal, and it should not be oversold as prevention.

---

## 26. Backup Access

Backups contain **everything, with no RLS**. They are the highest-value target in the system and the one place where all privacy controls are structurally absent.

- Encrypted at rest and in transit.
- **Access restricted to named operators**, separately from ordinary application access, and reviewed — not implicitly available to everyone with a Supabase dashboard login.
- The independent off-vendor export (architecture §20) is **encrypted before it leaves**, and its destination credentials are treated with the same care as the service-role key.
- **Restores are rehearsed**, and a restore into a non-production environment must never carry real member data into a less-controlled place — restore drills use anonymised or isolated environments.
- Storage objects need their own backup treatment; database backups do not cover them, and a "restored" memory with no photograph is not a restored memory.
- **Accepted residual risk:** an operator with backup access can read any batch. The control is organisational — least privilege, named access, review — not technical. It should be stated to users honestly rather than implied away.

---

## 27. EXIF / Location Metadata Policy

**Policy intent: GPS coordinates and other unnecessary identifying EXIF should not be silently shared with a batch.**

A phone photo routinely embeds exact latitude/longitude, capture timestamp, device serial-adjacent identifiers, and sometimes the owner's name. In this product that means uploading a photo taken at home can disclose **where you live** to 120 classmates — and keep disclosing it for twenty years. The photograph itself does not reveal that; the metadata does.

**What should be stripped:** GPS/location, device and owner identifiers, thumbnails (which can differ from the visible image), and any maker-note blob.
**What should be preserved:** capture date/time — genuinely valuable for a chronological archive, and it feeds `occurred_on`.

**The unresolved conflict.** Stripping metadata means **modifying the bytes**, and two established decisions currently forbid exactly that:

1. *Originals are preserved unmodified* (project-context §9.10, database.md §17).
2. *The MVP performs no media inspection or processing* (ADR-08a) — the same reason duration and codec cannot be verified.

So the MVP as currently specified **cannot strip EXIF server-side**. The options, none free:

| Option | Effect | Cost |
|---|---|---|
| **Client-side strip before upload** | Removes GPS in the common case | Unverifiable and bypassable; usually re-encodes, so it degrades the preservation-quality original |
| **Server-side strip at finalize** | Reliable and enforceable | Requires the media-processing step ADR-08a excludes; must define whether the untouched original is retained privately or discarded |
| **Store original, strip on serve** | Original preserved perfectly | Needs read-path processing; the unstripped bytes still sit in a bucket members can be granted access to |
| **Accept and disclose** | No engineering cost | Ships a product that quietly shares members' home locations — hard to defend for a privacy-first archive |

This needs a decision before launch. It is listed as a **blocker** in §32.

**Facial recognition: never.** No automatic face detection, no clustering, no suggested tagging, no biometric derivation of any kind — permanently excluded by the PRD, not deferred. Any future person-tagging is manual only, and no schema affordance for automated recognition exists (database.md §1.3).

---

## 28. CSRF / XSS / SQL Injection Considerations

**CSRF**
- Server Actions are the default write surface and carry framework-level origin verification; that protection is a reason to prefer them over hand-rolled mutating routes.
- Any mutating Route Handler needs explicit origin/method checks — it does not inherit the Action protections.
- Session cookies follow the supported Supabase SSR strategy (§2); `SameSite` behaviour is that library's, and is verified rather than assumed.
- Cron and webhook routes authenticate by shared secret or signature before parsing, so they are not CSRF-reachable in any meaningful sense.

**XSS**
- React escapes by default. The rules that keep that true: **no `dangerouslySetInnerHTML` on any user-supplied value**, ever; captions, comments, names, bios and filenames render as text, never as markup.
- **No markdown or rich-text rendering of user content in MVP.** If it is ever added, it needs a sanitiser and its own review.
- **No SVG uploads** (§15) — the single most likely stored-XSS vector in a media product.
- User-supplied URLs, if ever rendered as links, are scheme-allowlisted (`http`/`https` only) to block `javascript:`.
- **CSP as defence in depth** (§29), on the assumption that some escaping bug will eventually exist.
- A stored-XSS bug here is especially severe: it executes in the session of a *member*, which means it inherits their access to the batch archive.

**SQL injection**
- All ordinary access is parameterised through the Supabase client / PostgREST; string-concatenated SQL does not appear in application code.
- **The real risk is in `SECURITY DEFINER` functions**, which run with elevated rights. They must use parameters and **no dynamic SQL whatsoever**, use fully schema-qualified names, and pin an empty `search_path` so a caller-controlled schema cannot shadow a referenced object and hijack execution. This is both the injection control and the privilege-escalation control (§5.3).
- Direct PostgREST access means filter expressions are attacker-controlled by design; they are safely parameterised, so the exposure there is **authorization, not injection** — which is what §5 exists for.

**Other injection-adjacent**
- Open redirect on auth callback and post-redemption redirect — allowlist targets (§13).
- No shell execution, no dynamic module loading, no user input reaching a template compiler.

---

## 29. Security Headers

| Header | Value / intent |
|---|---|
| `Content-Security-Policy` | Strict. `default-src 'self'`; scripts from self with a nonce (avoid blanket `unsafe-inline`); `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; media/image sources limited to self and the Storage origin |
| `Strict-Transport-Security` | Long max-age, `includeSubDomains`, preload once stable |
| `X-Content-Type-Options` | `nosniff` — pairs with §15 to stop a mistyped upload being reinterpreted |
| `Referrer-Policy` | **`no-referrer`**. Useful, but **not sufficient on its own** for invite tokens — it suppresses only the `Referer` sent to third parties, not platform, proxy or browser-history exposure. The invite token design in **§9.1** is what actually addresses that |
| `X-Frame-Options` / `frame-ancestors` | Deny — no clickjacking of destructive controls |
| `Permissions-Policy` | Disable geolocation, camera, microphone, USB unless a feature needs them |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cache-Control` | **`private, no-store`** on every response carrying batch content (architecture §11). Shared caching of private HTML would defeat RLS entirely |

Applied centrally (middleware / platform config) so a new route is protected by default rather than by remembering.

---

## 30. Dependency / Security Update Policy

- **Lockfile committed**; reproducible installs in CI.
- **Automated dependency updates** (Dependabot/Renovate) with security advisories triaged on a defined cadence — critical promptly, others batched.
- **`npm audit` (or equivalent) runs in CI** and fails the build on high-severity advisories in production dependencies.
- **New dependencies are a reviewed decision**, weighed on maintenance health and transitive footprint, not convenience.
- **shadcn/ui components are vendored into the repo** — once copied they are our code, reviewed as our code, and not silently updated.
- **Supabase client libraries are pinned and updated deliberately**, since they sit directly on the auth and data path.
- **Framework patches are prioritised**: Next.js middleware and Server Action vulnerabilities have historically been authorization-relevant, and this product routes both authentication and authorization through them.
- **The blast-radius argument for restraint:** every server-side package runs in the same process as the service-role key (§12). A compromised transitive dependency does not need to find a bug in our policies — it can read the key that ignores them. Fewer server dependencies is a security control, not just hygiene.

---

## 31. Top 10 Security Rules

1. **The database is the authorization boundary.** The browser can reach Postgres directly with the public anon key, so UI hiding and Server Action checks are ergonomics, never the guarantee. For direct table access that boundary is **RLS**; for the high-risk writes performed by privileged RPCs it is **the function's own explicit authorization logic** (§5.2.2). Both are database-side; neither can be bypassed from the application.
2. **Deny by default, fail closed.** Every table has RLS forced, no permissive fallback, and predicates that evaluate to false for an unauthenticated caller.
3. **Access derives from *active* membership in the row's batch** — never from authorship, never from a pending request, never from having been a member once, never from possessing an id.
4. **Never trust the client for identity, role, batch, or path.** Session establishes who; the server re-derives everything else.
5. **The service-role key never leaves the server**, lives in one module, has an enumerated call-site list, and appears in no log, bundle, or error.
6. **Every private resource carries its batch id, and every write policy checks it** — so a member of one batch cannot read *or plant* rows in another. **High-risk writes are not direct DML at all**: they go through narrow validated functions, and no caller can create their own membership row by supplying a batch id (§5.2).
7. **Invite links are bearer credentials.** Hashed at rest, never selectable by clients, member-only, **expiry-controlled**, revocable, use-capped, rate-limited, never a bypass of the approval gate — and **never placed where a platform log will capture the raw token** (§9.1).
8. **All buckets are private and protected by Storage RLS**, which is the media authorization boundary — and it must mirror **database visibility, not just membership**: deleted, moderated-away, pending, rejected and (later) locked content is not fetchable by path (§7.1). Signed URLs are a delivery convenience — **bearer capabilities for one object, transferable until expiry** — never stored, cached, or logged. Our short TTL binds the URLs *we* mint; an authorized member can mint their own (§8.1).
9. **No SVG, strict type allowlist, authoritative *size* enforcement, and rejected bytes deleted.** Content type is metadata enforcement, not proof of file contents; safe response headers and a separate origin are what contain the risk.
10. **Logs and backups are outside RLS.** Never log content, tokens, or URLs; treat backup access as the most privileged access in the system.

---

## 32. Security Blockers and Open Risks

### Blockers — must be decided before launch

**B1 — EXIF / GPS stripping has no MVP answer, and the current specification forbids one.**
Stripping metadata requires modifying bytes, which collides with "originals preserved unmodified" and with the no-media-processing MVP stance (§27). Shipping as-specified means members silently broadcast their home coordinates to their batch, permanently. This is a privacy defect in a privacy-first product; one of the four options in §27 must be chosen deliberately.

**B2 — The privileged database-function execution model must be settled and verified before any policy or RPC is written.**
This covers two things that share one root cause. First, **RLS helper recursion**: the membership predicate is read by nearly every policy, including policies on `batch_members` itself, so without the constrained design in §5.3 policies either error or behave unpredictably. Second, **the RPC-only write path** (§5.2.2): client DML is revoked, so those writes require a function executing with privileges the caller lacks — and inside it, the function's own checks, not RLS, are what authorize the write.

Both depend on the same unverified assumption: `SECURITY DEFINER` does **not** automatically bypass `FORCE ROW LEVEL SECURITY`, so ownership and execution role must be chosen deliberately and **the behaviour proven in the target Supabase environment** before anything depends on it. Both also create privilege-escalation surfaces if written carelessly. This is a prerequisite for the whole authorization design, not an implementation detail — and it means the privileged functions are trusted security code requiring adversarial tests of their own.

**B3 — Owner account deletion can strand a batch (database.md Q3).**
Postgres enforces at most one owner but cannot enforce at least one. A batch that reaches zero owners cannot transfer ownership or be deleted, and if admins also depart it becomes unmoderatable — a security problem, not merely an operational one. Choose: block deletion pending transfer, auto-promote, or allow a claimable ownerless state.

**B4 — No platform-level moderation path (§19).**
If the abuser is the batch owner, nobody inside the batch outranks them and no operator tooling exists. For illegal content or a hostile owner, the only lever is raw service-role access, which is neither a process nor auditable as one. A minimal, audited operator capability — and a policy governing its use — is needed before real users arrive.

### Risks — accepted for MVP, with mitigations, worth revisiting

**R1 — Signed URLs survive membership removal** until they expire (§8). Mitigation: short TTLs. Contradicts a strict reading of "removal is immediate", so the TTL choice is a security decision, not a performance one.

**R2 — Private media vs. image optimization** (architecture risk #3). Whichever resolution is taken, a cached media response must never outlive the viewer's authorization. If an application media route is introduced, it is a new authorization surface requiring the full §5 treatment.

**R3 — No MFA and no step-up authentication** (§2). Batch deletion and ownership transfer are irreversible actions protected only by a session. Re-authentication before destructive actions is the cheap partial mitigation.

**R4 — Account deletion does not delete contributions** (§22). Defensible as product design; needs honest user-facing wording and legal review against erasure rights before launch.

**R5 — Audit trail loses actor identity on account deletion** (§20). The action survives, the actor does not — for exactly the person most likely to delete their account after abuse.

**R6 — HEIC is excluded** (§15). Not a security issue, but it means many iPhone uploads fail with no in-product path forward. A product answer is needed or members will hit a wall on their most common upload.

**R7 — No storage quotas** (§16). A member can consume a batch's storage within per-file caps. Bounded socially and by billing visibility; revisit if abused.

**R8 — Backups are outside every control in this document** (§26). Mitigated organisationally, not technically. Should be disclosed to users rather than implied away.

**R9 — Media response headers are not ours to set when Storage serves the bytes** (§15). `nosniff` and content disposition on objects fetched directly from the Storage origin are whatever Supabase returns; application-level header configuration does not reach them. **Verify actual Storage response behaviour before launch**; if the required headers cannot be guaranteed, the media-delivery design must compensate — an authorizing application route, or an allowlist restricted to types that are inert however they are served.

**R10 — Export scope remains open** (§25, database.md Q9). Not a defect, but the security invariants in §25 must be satisfied by whatever scope is eventually chosen, and the scope decision must precede implementation rather than emerge from it.

---

STOP — Prompt 05 complete. `docs/rules.md` is **not** started, no policies, SQL, migrations or application code were written. Awaiting the next instruction.
