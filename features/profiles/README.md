# features/profiles

Implemented in **Phase 1 — Authentication & Profile**.

Owns the `profiles` table's read/write surface, profile onboarding, and the
controlled avatar upload flow. Writable columns are `display_name` and `bio`
only; `onboarding_completed_at` and `avatar_path` change through the controlled
write paths in security.md §5.4.3 (`complete_onboarding()`,
`set_own_avatar_path()`), never by ordinary DML.

- `queries.ts` — `getOwnProfile()`, `getOwnAvatarUrl()`, and (since **Phase 2**)
  `getProfilesByIds()` / `getAvatarUrl()` — the exported reads other domains
  (currently `features/memberships`' roster view) use to resolve co-members'
  display info, instead of querying `profiles` directly (architecture §17).
  RLS decides what actually comes back: own row always, plus (since Phase 2)
  any profile sharing an active batch with the caller (security.md §5.4,
  §6.1).
- `actions.ts` — `saveOwnProfileAction` (create-or-update own row) is
  deliberately separate from `markOnboardingCompleteAction` (the controlled
  RPC call): the avatar controlled-write path requires the profile row to
  already exist, and the onboarding form uploads an avatar, if any, between
  the two steps. Plus `updateProfileAction`, `requestAvatarUploadAction`,
  `confirmAvatarUploadAction`.
- `permissions.ts` — own-row-only for this phase.
- `components/` — `OnboardingForm`, `ProfileSettingsForm`, `AvatarUploader`
  (server-composed path `{auth.uid()}/{uuid}`, direct-to-Storage upload, then
  the controlled write path records it — architecture §7–8; security.md
  §6.1).

Avatar Storage policy was self-only in Phase 1; **Phase 2** additively extends
read access to co-members of an active shared batch (security.md §6.1) — the
original self-only policies are unchanged, and Postgres OR-combines the two.
