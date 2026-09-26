# features/profiles

Implemented in **Phase 1 — Authentication & Profile**.

Owns the `profiles` table's read/write surface, profile onboarding, and the
controlled avatar upload flow. Writable columns are `display_name` and `bio`
only; `onboarding_completed_at` and `avatar_path` change through the controlled
write paths in security.md §5.4.3 (`complete_onboarding()`,
`set_own_avatar_path()`), never by ordinary DML.

- `queries.ts` — `getOwnProfile()`, `getOwnAvatarUrl()`. Own row/object only
  in this phase — the shared-batch clause depends on `batch_members`, which
  does not exist until Phase 2 (phases.md Phase 1 "Explicitly NOT in scope").
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

Avatar Storage policy is self-only at this phase (`storage.foldername`-scoped
to `auth.uid()`), per phases.md Phase 1.
