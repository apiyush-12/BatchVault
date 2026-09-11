# BatchVault — Design System & UX Direction

Status: Draft — MVP design direction
Sources of truth (per `/prompts/07_DESIGN.md`): `/docs/project-context.md`, `/docs/PRD.md`, `/docs/rules.md`
Cross-checked for consistency against: `/docs/architecture.md`, `/docs/database.md`, `/docs/security.md`
Prepared per: `/prompts/07_DESIGN.md`

**What this document is.** This is visual and interaction direction only. It defines how BatchVault should *feel* and behave at the UI/UX level, so that implementation (starting no earlier than Prompt 08's phase plan) has a single, consistent language to build against. It implements nothing, invents no product behavior, data, architecture, or security decision beyond what `project-context.md`, `PRD.md`, `architecture.md`, `database.md`, and `security.md` already establish, and it does not weaken any privacy, authorization, or RLS-adjacent rule. Where anything here conflicts with those five documents or with `rules.md`, those documents win and this document is wrong.

**Locked implementation substrate** (`rules.md` §1–2, carried through every section below without restating it each time): **Tailwind CSS** for styling, **shadcn/ui** (vendored) for base components, **Framer Motion** for animation, **Lucide React** for icons, **React Hook Form** for client forms, **Zod** for schema validation (client UX layer and, independently, every server boundary). No second styling system, component kit, animation library, icon set, form library, or validation library is introduced.

**Product feeling, stated once, referenced everywhere:** modern, emotional, youthful, premium, memory-first, and nostalgic without looking outdated (per `07_DESIGN.md` and project-context §9.6–7). Never a generic enterprise SaaS dashboard. Never Instagram, TikTok, WhatsApp, or a generic social network (project-context §9.12, §11; PRD §4).

---

## Part A — Foundations

### 1. Visual Direction

BatchVault should read as a **private, collective keepsake** — closer to a shared scrapbook or a sealed time capsule than to a cloud drive or a social feed. The product's principles (project-context §9) are the design brief in miniature: privacy-first, mobile-first, photography-centered, modern/emotional/youthful/premium, nostalgic without looking old-fashioned, accessible, built for long-term return.

- **Photography is the visual center.** Chrome (navigation, chips, buttons) is deliberately quiet so uploaded photos and videos supply most of a screen's color and energy (07_DESIGN.md: "photography and memories should be the visual center").
- **Nostalgia is expressed through content and moments, not through aging the interface.** No sepia overlays, distressed textures, or vintage skeuomorphism applied to the *product's own* chrome. Warmth comes from framing (§11), restrained motion (§28–29), and human copy (§2) — not from making the UI itself look old.
- **Never a dashboard.** No KPI tiles, analytics-chart aesthetics, or dense data tables — including for Owner/Admin/Moderator surfaces (§15, §24). Every screen, including moderation and settings, stays inside the same warm visual language.
- **The product is deliberately "slow."** It is not optimized for daily engagement or virality (project-context §11); the visual language should never borrow social-feed patterns that exist to maximize time-on-app (infinite algorithmic feeds, streaks, follower counts, like tickers).

### 2. Brand Personality

Anchors: **warm, intimate, trustworthy, unhurried, quietly premium, collective, enduring.**

- **Collective, not personal.** Copy and framing favor "your batch" / "together" over "my feed" / "my profile" — the archive belongs to the batch (project-context §7, database.md §13's "the batch collectively owns the archive").
- **Quietly premium, not flashy.** Restraint signals quality — a small, considered set of colors/motions/type styles used consistently beats a large, loud one.
- **Contrast against the products this explicitly is not** (project-context §11, PRD §4): not performative like Instagram, not utilitarian/transient like WhatsApp, not fast/algorithmic like TikTok. BatchVault's voice is closer to a keepsake box than a feed — no growth-hacking language, no urgency badges, no gamified streaks.
- **Voice:** warm and specific, never corporate-SaaS ("Your batch's first memory is waiting" rather than "Get started"). Errors and empty states carry the same warmth (§19–20).

### 3. UI Principles

1. **Memory-first, chrome-last.** Media is the largest, most prominent element on any screen it appears on; controls recede (§11).
2. **People + memories + stories, not files + folders** — the product's explicit UX principle (07_DESIGN.md); elaborated as its own section below.
3. **Calm by default.** No unnecessary counters, badges, or urgency cues; this is a preservation product, not an engagement product (project-context §11).
4. **Mobile-first, thumb-reachable.** Designed for the phone first, then enhanced up (project-context §9.4; PRD §10.3; architecture §2; rules.md §1.5).
5. **Private-by-feel, not only private-by-policy.** The UI should visually communicate "a small, closed room for us" — a clear batch identity, no public-facing chrome bleeding in from outside a batch.
6. **One clear primary action per screen.**
7. **Consistent, restrained motion** (§28–29).
8. **Accessible by default** (§25–27), not retrofitted.
9. **Never a dashboard**, even where the underlying feature is administrative (§1, §24).

### 4. Color Roles

No specific hex values are fixed here — that is an implementation-time decision — but the **role system** every palette (light and dark) must fill:

- **Brand/primary** — a warm, human accent, used sparingly for the one primary action per screen (§3.6) and for key moments (invite, upload, join). Not flooded across the UI.
- **Neutral/surface scale** — the dominant palette. Warm-neutral rather than stark cold gray, so photography supplies most of a screen's perceived color (§1).
- **Text** — high-contrast ink tones on both light and dark surfaces, meeting the accessibility bar in §25.
- **Accent/secondary** — reserved for reactions, highlights, and celebratory or nostalgic moments (§28's "celebration" and "reveal" motion categories) — used more playfully and less frequently than brand primary.
- **Semantic states** — success (upload complete, join approved), warning (pending approval, an invite nearing expiry), danger (removal, deletion, report actions), info (neutral system messages). Danger gets the strongest, most deliberate visual treatment specifically for the irreversible actions rules.md §5 and security.md §11/§24 single out (ownership transfer, batch deletion).
- **Overlay/scrim** — for modals/drawers (§16) and for text legibility where captions sit over photography.
- **Focus ring** — one consistent, highly visible color, distinct enough from brand primary and from any photograph behind it (§27).

### 5. Light/Dark Mode Strategy

- **Both modes are supported.** The product is used at all hours, including a returning alumna revisiting memories late at night (PRD Journey D).
- **Default follows the OS/browser `prefers-color-scheme`**, with a manual override available. The override is a client-side preference; it does not require a new database column (`profiles` has no such field per `database.md` §3.1) unless a future decision explicitly adds server-side persistence — that would be a `database.md` change, not something this document introduces.
- **Dark mode is not a color inversion.** Surfaces shift to a deep, warm-neutral tone (never pure black) so photography and the brand accent still read as premium at night, not muddy or "hacker-terminal."
- **Elevation adapts.** Shadows read poorly on dark surfaces, so dark-mode elevation leans on subtle surface-tone/border separation more than drop shadow (§9).
- Text contrast is held to the same accessibility bar (§25) in both modes.

### 6. Typography System

- **A humanist, warm sans-serif** for all UI text — modern and legible, not a cold corporate grotesk, and not a decorative/script face for body or long-form text. A handwritten- or personal-feeling accent face, if used at all, is reserved for small nostalgic moments (a yearbook quote, a time-capsule letter) and never for body copy, navigation, or anything that must stay comfortably readable (PRD §19).
- **A small, deliberate type scale**: display/hero, heading-lg, heading-md, heading-sm, body, body-small, caption/meta — enough steps to build hierarchy, no more.
- **User-authored captions carry more typographic presence than system metadata.** A memory's caption is set with slightly more warmth/weight than the quiet, muted styling used for dates, counts, and other machine-generated text — reinforcing "people + memories + stories" over "files + folders."
- **Legible at mobile sizes first** (PRD §19, §20), with line-height and minimum size chosen for comfortable phone reading.
- **Respects OS/browser text-scaling.** Layouts do not break or truncate meaningfully when a user increases their font size — an accessibility requirement (§25), not an edge case.

### 7. Spacing System

- **One consistent spacing scale**, expressed through Tailwind's spacing tokens (rules.md §1.5) — no ad hoc pixel values anywhere.
- **Density is a deliberate, per-surface choice.** The gallery grid (§30) is denser — many thumbnails, small gaps — while memory detail (§32) is generous and breathing — one memory, room to read its story. Neither density is accidental.
- **Comfortable touch targets** sized for real thumb use on mobile (§22), not mouse-precision assumptions.

### 8. Border Radius Strategy

- **A soft, warm, consistently rounded language** across inputs, buttons, chips, cards, modals, and photo frames — reinforcing "premium, emotional, youthful" rather than sharp corporate edges.
- **A small radius scale**, not one-off values: a smaller radius for inputs/buttons/chips, a larger radius for cards/photos/modals.
- **Primary/hero photography** may take a slightly larger radius or a light "printed photo" framing treatment (§11) to add warmth without becoming skeuomorphic.

### 9. Shadows / Elevation

- **Soft, diffuse, warm-tinted shadows** — never a heavy, high-contrast drop shadow that reads as a generic dashboard.
- **A small elevation scale**: resting/flat, raised/card, floating/popover, modal/overlay-top. Consistent across the product, not invented per component.
- **Dark mode leans on surface-tone and border separation over shadow** (§5), since shadow contrast degrades on dark backgrounds.

### 10. Iconography

- **Lucide React, exclusively** (locked, rules.md §1.5/§2/§3) — one consistent stroke weight and visual style; no second icon set is ever mixed in.
- **Icons support; they never substitute for a real photo or stand in as filler content** (§1's memory-first principle).
- **Every icon-only control carries an accessible name** (§25–26) — an icon is never the sole way a control's purpose is conveyed.
- Lucide's clean, simple line style already fits "modern, premium" — no need for a cuter or more literal icon style that would tip toward "generic consumer app."

### 11. Photography Treatment

The most important surface-level decision in this document, because photography *is* the product's visual center (§1, project-context §9.5).

- **Media is the hero of every surface it appears on** — full-bleed or near-full-bleed where reasonable, with minimal chrome overlapping it.
- **Originals are never altered by the app.** They are preserved unmodified (project-context §9.10; architecture §9) — nostalgia comes from framing and motion, never from an artificial "aging" filter applied over a real memory.
- **Aspect ratio**: memory detail (§32) preserves the true, uncropped photo; gallery thumbnails (§30) may crop to a consistent grid ratio for scannability, since that is a distinct, generated derivative, never the original (architecture §9).
- **Blur-placeholder-first loading, always.** Every image resolves from its tiny stored placeholder (`database.md` §3.6 `blur_placeholder`) to the full derivative — never a blank box, never a layout shift (architecture §9, §18 below).
- **Video shows its poster frame first** (`database.md` §3.6 `poster_media_asset_id`); if no poster exists, a neutral, on-brand placeholder is shown — never a generic broken-image icon (architecture §10).
- **An optional "keepsake" framing treatment** (soft shadow, rounded corner, slight lift — a nod to a printed photo edge) is available for hero/primary images, used sparingly rather than applied to every thumbnail in a dense grid (§7's density principle).
- **Multi-asset memories** show their primary asset — position 0 (`database.md` §3.5–3.6) — first, with a simple "more inside" affordance (a stacked-photo cue; see "Dynamic Visuals" → photo stacks) rather than a generic carousel counter.

---

## Part B — Components & Interaction Patterns

### 12. Cards

- **The card is the primary structural unit for a memory**: photo (blur-placeholder-first, §11) dominant, minimal metadata overlay in quiet typography (date, event name), an optional reaction/comment affordance.
- **Never a file-manager row.** Surfaced metadata is human ("Farewell Night · Apr 12"), never technical ("IMG_2043.jpg — 4.2 MB").
- **One shared card language** — same radius (§8), elevation (§9), and spacing (§7) rules — applies to memory cards, member/profile cards, batch cards, and settings cards, so the whole product feels like one system rather than a gallery with a dashboard bolted on.

### 13. Buttons

- **A small set of variants**: primary (the one emphasized action per screen, §3.6), secondary/outline, ghost/quiet, destructive, and icon-button.
- **Built on shadcn/ui's button primitive** (vendored, architecture §16; rules.md §1.5), restyled to BatchVault's radius/color/type — never left at unstyled defaults.
- **Destructive actions never share primary visual weight** until their confirmation step, where the danger treatment becomes explicit and unambiguous — matching the blast-radius-scaled confirmation rules.md §5 requires (with security.md §11/§24 as the specific source for the two highest-tier cases: ownership transfer and batch deletion).
- **Loading/disabled/pressed states are explicit** — a small in-button indicator, never a full-page blocking spinner for a small action.

### 14. Forms

- **React Hook Form with a Zod resolver is the standard pattern for every form** (locked, rules.md §1.6/§2): profile onboarding, batch creation, memory metadata, comment composer, settings, reports. Client validation is a UX layer only — every server boundary independently re-validates the same input with Zod regardless of what the client already checked (rules.md §1.6).
- **Inline, human error copy**, tied to field context — never a generic banner disconnected from the field it describes (§25's accessible-error requirement).
- **Long forms are broken into short, mobile-friendly steps** (profile onboarding, batch identity at creation) rather than one long scroll — consistent with mobile-first (§22) and PRD Journey A.
- **The upload form (caption, event, date) sits next to the photo being described**, as part of the memory-creation moment — not a buried settings-like form encountered after the fact.
- **High-friction confirmations** (batch deletion naming the batch, ownership transfer) use a deliberate typed/selected confirmation field, not just a button press (rules.md §5; security.md §11/§24).

### 15. Navigation

- **Mobile-first primary navigation is a bottom, thumb-reachable bar** inside a batch (gallery/timeline, and account/profile) — minimal, never a sprawling admin sidebar.
- **No cross-batch feed.** A lightweight way to move between the batches a user belongs to (PRD §16's multi-batch edge case) is available, but every screen inside a batch is unambiguously scoped to that one batch — reinforcing the privacy model at the UX level, without this document claiming that navigation is what enforces it (enforcement is RLS, per security.md §3, §31; rules.md §8's Top-15 rule #1).
- **Admin/Moderator/Owner tooling** (member management, moderation queue, settings) lives behind clearly labeled, secondary navigation — present, but not visually dominant, so the everyday experience for a Member stays memory-first, not management-first (§1, §24).
- **Desktop/tablet adapt the same information architecture** to a persistent side or top navigation rather than inventing a different structure (§23–24).

### 16. Modals / Drawers

- **Drawers/sheets (sliding from the bottom on mobile) are preferred** for most contextual actions — comment composer, reaction picker, upload steps — since they feel native on a phone.
- **Centered, scrim-backed modals are reserved for higher-stakes moments**: destructive confirmations (batch deletion, ownership transfer, member removal) and short focused decisions (approve/reject a join request). The added visual weight of a centered modal signals "decide deliberately," matching rules.md §5's confirmation scaling.
- **Built on shadcn/ui's dialog/sheet primitives** (architecture §16), animated with Framer Motion respecting reduced motion (§29).
- **Never stack more than one modal/drawer**; a modal never opens a second modal.

### 17. Toasts

- **Lightweight, short-lived, non-blocking** — for confirmations that don't need a full page change: comment posted, reaction added, invite link copied, settings saved.
- **Toast copy is warm and specific** ("Memory added to the gallery," never a bare "Success") — consistent with brand voice (§2) and the generic-but-warm error copy required elsewhere (§20; rules.md §5).
- **Toasts are not used for anything requiring sustained attention** (a rejected upload gets a persistent state, §20, not a toast that can be missed).
- If a self-delete "undo" affordance for soft-deleted content (a memory or comment) is ever offered, the corresponding UI pattern is a short-lived toast-based undo rather than a separate recovery screen — consistent with the soft-delete-plus-retention-window model already in `database.md` §12/§24. This document does not assert that such an undo action ships in MVP; whether and when it exists is a product/implementation decision outside this document's scope.

### 18. Skeleton / Loading States

- **Every media-bearing surface** (gallery grid, memory detail, avatar) loads with a blur-placeholder or a skeleton shaped exactly like the eventual content — same aspect ratio, same card shape — never a generic spinner replacing a whole page, and never a layout shift when real content arrives (architecture §9, §11 above).
- **Text/list content** (comments, member lists) uses simple skeleton bars matching line-length rhythm — not shimmering block placeholders that feel corporate.
- **Upload progress is explicit and honest** — a real progress bar/percentage on the media being uploaded (PRD §20; architecture §8), not a decorative spinner. The user watches their memory arrive (see "Dynamic Visuals" → upload progress).

### 19. Empty States

- **Warm and specific to the moment**, never a generic "No data": a brand-new batch's empty gallery invites the first memory; an empty member list before invites go out explains next steps; a batch with no open reports shows a quiet, reassuring state.
- **Restrained illustration**, if used at all — warm and human, not stock-SaaS clipart. Lucide iconography (§10) is usually sufficient.
- **Always includes the relevant next action** as a single, clear CTA (§3.6's "one primary action" principle).

### 20. Error States

- **Generic, and never disclosing whether a private resource exists** (rules.md §5, §8 rule 14; security.md §3's "indistinguishable denial"). "Not found" and "not authorized" use the same shared "can't show this" state component — not two visually distinct pages that would leak the distinction.
- **Calm, not alarming, for recoverable situations** (a failed upload, a network hiccup) — offer retry; do not shame the user (rules.md §5's upload-failure guidance).
- **A single, dedicated state for an invalid/expired/revoked invite link** — visually identical regardless of which of those three is actually true, matching the one-generic-response requirement in security.md §9.
- **Serious errors on a destructive flow** (e.g., a session issue mid-deletion) get a clear, non-toast treatment, since they need full attention (§17's boundary).

### 21. Success States

- **Success is communicated inline wherever possible** — a memory appearing in the gallery *is* the success state — rather than always routing through a separate confirmation screen (§3's "people + memories + stories," not friction-heavy confirmation chrome).
- **A dedicated success moment is reserved for real milestones**: batch created, invite redeemed and joined, join request approved. These get a brief, warm, optionally lightly animated moment (see "Dynamic Visuals" → milestone celebrations) — restrained, never a full-screen confetti blast, which would clash with "premium" and the product's explicit non-goal of gamified engagement (project-context §11).

---

## Part C — Responsive Behavior

### 22. Mobile Behavior

- **Mobile is the primary, designed-first surface for every flow** (project-context §9.4; PRD §10.3; architecture §2; rules.md §1.5) — never a shrunken desktop layout.
- **Bottom-anchored primary navigation and primary actions**, within comfortable thumb reach (§15).
- **Single-column, scroll-first layouts**; the gallery grid (§30) uses a phone-appropriate column count rather than a dense desktop mosaic.
- **The upload flow is optimized for the phone camera / photo-library path** — this is how memories are actually created for this product — using drawer-based steps (§16).
- **Touch targets and spacing** (§7) sized for real thumb use.

### 23. Tablet Behavior

- **An intermediate layout**: the gallery grid gains columns, but navigation and primary actions stay close to the mobile pattern (easily thumb/finger-reachable) rather than jumping straight to desktop chrome — tablets are held and touched, not clicked.
- **Modals/drawers** may take a slightly larger, more centered presentation while still feeling closer to mobile drawers than desktop dialogs.

### 24. Desktop Behavior

- **A persistent navigation surface** (side or top) and a wider, multi-column gallery grid — more room, not a different, more corporate product. Color, type, radius, shadow, and motion stay identical to mobile (§1–9).
- **Memory detail** (§32) can use the extra width for a side-by-side layout (media alongside caption/comments) rather than the mobile stacked layout, without changing what information is shown.
- **No regression into dashboard patterns** — data tables, dense KPI grids — even for Owner/Admin tooling. Member management and moderation stay within the same card/list language as everywhere else (§3.9, §12, §15).

---

## Part D — Accessibility & Motion

### 25. Accessibility

- **WCAG AA color contrast** for text and meaningful UI, in both light and dark modes (§4–5), per PRD §19.
- **Every interactive element has an accessible name/label**, including icon-only buttons (§10, §13).
- **Every core flow named in PRD §19** — signup/login, onboarding, batch creation, join, upload, gallery browsing, memory detail, comments, reactions — is fully usable with a screen reader and keyboard alone (§26).
- **Captions serve as the meaningful text alternative for memory content** where feasible (PRD §19) — a photo or video is never the *only* way to understand what a memory is about when a caption exists.
- **Motion always respects `prefers-reduced-motion`, with zero exceptions** (§29) — a hard requirement, per PRD §19, architecture §2, and rules.md §1.5.
- **Form errors are associated with their field programmatically**, not conveyed by color alone (§14).

### 26. Keyboard Navigation

- **Full keyboard operability for every core flow** (PRD §19): logical tab order, every action reachable without a mouse, gallery tiles and memory cards keyboard-focusable and activatable.
- **Modals/drawers trap focus while open** and return focus to the triggering element on close (§16).
- **Skip-to-content and a logical heading structure** let keyboard and screen-reader users move past repeated navigation chrome quickly.
- **Any future keyboard shortcuts are additive**, layered on top of full mouse/touch/keyboard parity — never a required path to accomplish a task.

### 27. Focus States

- **One consistent, clearly visible focus indicator** everywhere — never suppressed for aesthetic reasons; `outline: none` without an equally visible replacement is not acceptable.
- **Legible against photography and both color modes** — an offset ring (rather than a color that could blend into an image) keeps focus unambiguous on a card containing a photo.
- **Focus is visually distinct from hover.** Hover is a hint; focus is a guarantee.

### 28. Motion Principles

- **Motion communicates; it is never decoration for its own sake** (07_DESIGN.md's explicit "do not animate everything").
- **Framer Motion only**, via shared wrappers in `components/motion/` (architecture §16; rules.md §1.5) — so easing, duration, and spring values stay consistent product-wide instead of being reinvented per component.
- **A small, consistent motion "grammar":** entrance (gentle fade/rise for new content), transition (a continuous-feeling move between a gallery tile and its detail view), feedback (a small scale/spring on tap/press), reveal (progressive reveal for timeline/throwback moments), celebration (a restrained, one-time flourish for milestones).
- **Durations lean short and physically plausible** (quick, spring-based easing) rather than slow and decorative — motion should feel effortless and premium, never showy.
- **Motion never blocks the ability to act** — no animation a user must wait out before a control becomes usable, aside from a deliberate, brief, always-skippable celebration moment.

### 29. Reduced-Motion Support

- **`prefers-reduced-motion` is honored everywhere motion appears, with zero exceptions** (PRD §19; architecture §2; rules.md §1.5) — a hard requirement, not a style preference.
- **Reduced motion swaps entrance/transition/celebration animation for an instant or near-instant equivalent** (a simple cross-fade or immediate state change) that preserves the same information — it never simply removes the affordance or the content.
- **Checked once, in the shared motion wrappers** (architecture §16), never re-implemented per component — the same "no duplicated logic" principle rules.md applies to code applies here to motion.

---

## Part E — Core Product Surfaces

### 30. Gallery Behavior

- **The gallery is the product's core surface** (architecture §9) — chronological by default, ordered by `occurred_on` (`database.md` §3.5), with event-based grouping/filtering as the PRD-specified alternative view (PRD §9.13).
- **Incremental, keyset/cursor-paginated loading** — never the whole archive at once (PRD §20; architecture §19; rules.md §2) — experienced by the user as smooth infinite scroll, not numbered pages.
- **Every tile is blur-placeholder-first** (§11, §18); thumbnails are a distinct, smaller derivative, never the full-resolution original (architecture §9).
- **Multi-asset memories** show their primary asset (position 0) with a lightweight "more inside" cue (§11).
- **Tile → detail transitions feel continuous** (§28's "transition" category), not a hard page reload.
- **Filtering/grouping controls stay quiet and secondary** — photography remains the visual majority of the screen at all times (§1, §3.6).

### 31. Timeline Behavior

- **The same underlying chronological data as the gallery** (`database.md` §3.5's `occurred_on` ordering), presented as a distinct browsing mode: a vertical, date-anchored scroll grouped by event or time period, emphasizing the feeling of moving through the batch's years together (project-context §2, §7) rather than a dense grid.
- **Date/time markers are human and calendar-relatable** ("Senior Year," a semester, a month) rather than raw timestamps.
- **Reveal motion is used sparingly** here (see "Dynamic Visuals" → timeline reveals) — content gently appears as it enters view, and simply appears (no reveal animation) under reduced motion (§29).
- **A simple way to jump to an earlier time period** supports the long-dormant-return scenario (PRD Journey D — an alumna returning after years) without requiring a long manual scroll from the very start. This is a navigation aid within the already-specified chronological/event browsing capability (PRD §9.13) — not the advanced-search feature that PRD §15 explicitly defers to post-MVP.

### 32. Memory Detail Behavior

- **Media-dominant layout**: the photo/video is the largest element on screen; caption, event/date metadata, comments, and reactions are present but secondary (PRD §9.14).
- **Loads promptly on first open** — poster/blur placeholder immediately, full asset progressively — with heavier media (video) allowed to load progressively rather than blocking the page (PRD §20).
- **Comments render as a flat, chronological list** (`database.md` §3.7 — no threading in MVP) — no threaded-reply affordance is designed, since the data model does not support one.
- **Reactions are shown as a single, switchable choice per person** (`database.md` §3.8), never as a generic, upward-ticking "like count" — the visual treatment favors "who reacted and how" over a raw accumulating number, consistent with the product's explicit non-goal of an engagement/virality mechanic (project-context §11).
- **A departed author renders gracefully** ("a former member," per `database.md` §12) rather than as an error or a blank field.
- **Report/moderation controls stay visually quiet for ordinary members** — a secondary affordance, not a prominent button — and moderator-only actions (remove) simply are not rendered for a viewer who cannot use them, mirroring rules.md's Layer-1 "UI hides or disables controls" convenience posture (security.md §3) without this document implying that UI-level hiding is what enforces the boundary.

---

## Part F — Future & Landing Surfaces

### 33. Time-Capsule Visual Direction

*(Post-MVP direction only — per `database.md` §22 and ADR-11, and rules.md §6's "never add future-phase features while already here." Not an instruction to build this now. Sealed-capsule visibility — whether a locked capsule's existence is shown at all before unlock — is an explicit open product decision, `database.md` Q8; the direction below supports either outcome without pre-deciding it.)*

- **The emotional premise** (project-context §12; `database.md` §22): a capsule is a deliberately sealed, future-dated collection. Visually it should feel like a wrapped or sealed box/envelope — never a disabled, greyed-out list item.
- **If a sealed capsule's existence is shown** — the "a box you can see but not open" direction `database.md` itself calls likely preferable — its card shows an unlock date/countdown and an unambiguous "sealed" state (a lock/seal motif via Lucide iconography), never a blurred preview of its contents, since content must not leak before unlock (security.md §5.5).
- **Unlock is never depicted as something the UI "does."** The moment a capsule becomes viewable is a natural consequence of visiting after `unlock_at` — consistent with unlock being a read-time predicate, not a scheduled event (`database.md` §22: "no cron job unlocks content"). There is no client-side countdown that flips a lock at zero; the UI reflects state, it does not create it.
- **On a genuine, already-unlocked visit**, a warm, one-time "reveal" moment is appropriate (see "Dynamic Visuals" → time-capsule countdown, throwback reveals) — restrained, never gamified, fully reduced-motion-compatible (§29).
- **Standalone capsule messages** ("a letter to the future," `database.md` §22) are visually distinguished from a locked memory — an envelope/letter treatment rather than a photo frame — so the two payload types stay legible as different things.

### 34. Yearbook Visual Direction

*(Post-MVP direction only — same status as §33; per architecture §16, `database.md` §23, rules.md §6.)*

- **The emotional premise**: a per-member page within a batch's yearbook, evoking a physical yearbook page (project-context §12) — a portrait, a headline/superlative, a personal quote/reflection, and peer-authored notes (`database.md` §23's `yearbook_entries` plus a separate `yearbook_notes`).
- **Self-authored content is visually distinct from peer-authored notes.** A page's own headline/quote/reflection/portrait/favorite-memory reads differently from the signatures and messages classmates leave — two authorship types, two treatments, so the page never looks like one person's words were edited by others.
- **A draft/published distinction is visible at the design level** (`database.md` §23's `published_at`) — an unpublished page reads unmistakably as a private, unfinished space to its author, never as accidentally public or complete.
- **The overall yearbook presentation** (a grid or index of member pages) borrows the same warm, photography-first, restrained-motion language as the rest of the product — a special *section*, not a visually separate sub-product.

### 35. Landing-Page Direction

- **The unauthenticated landing page never previews or implies access to any real batch's private content** — batches are not discoverable and have no default public browsing surface (security.md §10; PRD §11; project-context §11), and even the invite-redemption landing page shows only a batch's name, nothing else (security.md §9). Any illustrative imagery on the marketing landing page is generic/placeholder, never pulled from an actual batch.
- **Its job is to explain the product and drive one action**: start/create a batch, or use an invite. No pricing tables, no feature-comparison grids, no enterprise-SaaS marketing chrome.
- **Visual tone matches the rest of the product** (§1–2) rather than a generic marketing template — warm and photography-forward.
- See "The Ideal Landing-Page Hero" at the end of this document for the specific hero treatment.

---

## Dynamic Visuals

Per `07_DESIGN.md`, motion is used *carefully*, for a specific, named set of moments — and nowhere else. Every item below inherits reduced-motion behavior from §29 without exception, and every item is built on the shared Framer Motion wrappers from §28.

- **Photo stacks** (§11, §30) — a memory with multiple assets shows a slight offset/stack visual; any fan/settle motion triggers on hover or focus only, never as a constant idle animation.
- **Timeline reveals** (§31) — content entering view on the timeline appears with a brief, gentle reveal; under reduced motion, it simply appears.
- **Gallery transitions** (§30) — a tile-to-detail transition feels continuous, not a hard cut.
- **Hover/focus states** (§27) — small, quick feedback; a hint, not a production.
- **Upload progress** (§18) — an honest, real-time progress indicator, never a decorative loop standing in for real state.
- **Time-capsule countdown** (§33) — a quiet, occasional-glance indicator; never a per-second-redrawing, anxiety-inducing timer.
- **Milestone celebrations** (§21, §33) — batch anniversaries, a successful join, a capsule unlock: a restrained, one-time flourish, never a persistent gamified badge system.
- **Throwback reveals** (§33, §31) — "on this day"-style resurfacing (project-context §12's long-term direction, post-MVP): when it exists, its reveal motion is warm and brief.

**The governing rule:** motion earns its place only where it clarifies meaning or adds genuine warmth to a specific, named moment. Everything else stays still. When in doubt, the correct default is: don't animate it.

---

## The Core UX Principle: People + Memories + Stories

The interface emphasizes **people, memories, and stories** — never **files, folders, or technical metadata** (07_DESIGN.md). This is not a slogan; it has concrete, checkable design consequences already threaded through this document:

- Human labels, never filenames or byte sizes ("Farewell Night · Apr 12," never "IMG_2043.jpg — 4.2 MB") — §12.
- Cards and stories, never file-manager rows or a directory tree — §1, §12, §15.
- Captions given real typographic presence, distinct from quiet system metadata — §6.
- Navigation organized around a batch and its people, never around a storage/quota framing (no "X MB used" chrome anywhere prominent) — §15.
- Reactions read as "who felt what," not an accumulating engagement metric — §32.
- Even administrative surfaces (member management, moderation, settings) keep the same warm, human visual language rather than becoming a technical control panel — §1, §3.9, §24.

---

## Design Language Summary

BatchVault looks and feels like a **private, collective keepsake** — warm, quietly premium, photography-first, and calm rather than attention-seeking. Chrome is deliberately restrained (a warm-neutral surface palette, one sparing brand accent, soft rounded shapes, diffuse shadows, a humanist type system) so that uploaded photos and videos supply a screen's real color and energy. Motion is a small, consistent grammar used only at named, meaningful moments — never decoration — and always yields instantly to `prefers-reduced-motion`. Every surface, from the gallery to moderation tooling, speaks the same visual language: cards over tables, stories over metadata, people over files. The product never borrows the visual patterns of the platforms it deliberately is not — no algorithmic feed, no engagement counters, no enterprise dashboard — because BatchVault is built for a batch to return to once a year, or once a decade, and feel instantly, warmly at home.

---

## The Ideal Landing-Page Hero

A full-bleed, warm photographic moment fills the top of the page — a soft, gently overlapping stack of a few illustrative, non-real photographs (never actual batch content, per §35 and security.md's no-preview rule) suggesting shared college memories: a group, a campus moment, a candid laugh. The stack sits with the light "keepsake" framing from §11 — a soft shadow, a slight rotation on the outer photos — evoking a scrapbook, not a stock-photo banner.

Over it, in the humanist display type from §6, a short, direct, emotionally warm headline — something in the register of *"Your batch, together, for life"* — paired with one quiet supporting line naming what the product actually is (a private, invite-only home for a batch's memories). A single, unmistakable primary action sits below: start a batch, or — if arriving via a link — join one. No secondary competing CTA, no pricing, no feature grid, no logo wall.

The composition is designed mobile-first: on a phone, the photo stack and headline stack vertically and the CTA is immediately reachable without scrolling past marketing chrome. Entrance motion is a single, gentle fade-and-rise (§28's "entrance" category) applied once on load, fully skipped under `prefers-reduced-motion` (§29) in favor of the content simply being present. The whole hero reads as an invitation into something intimate and already meaningful — not a pitch, not a dashboard preview, not a generic app-store screenshot.

---

STOP — Prompt 07 complete. No UI or components were implemented, no application code was created, and no packages were installed. `docs/design.md` has been re-read in full against all six source documents for contradictions (see summary below). Awaiting the next instruction before Prompt 08.
