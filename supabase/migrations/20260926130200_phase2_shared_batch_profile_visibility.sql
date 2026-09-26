-- Phase 2 — Batch Spaces.
--
-- Extends profile and avatar visibility to co-members of an active shared
-- batch (security.md §5.4, §6.1; phases.md Phase 2 "Extending the avatar
-- read rule to co-members of an active shared batch"). Purely additive:
-- Phase 1's own-row-only policies are untouched, and Postgres OR-combines
-- multiple permissive policies for the same command, so a caller is admitted
-- if EITHER the original own-row policy OR this new one matches.
--
-- Why this is safe against the recursion trap (security.md §5.3): this
-- policy is on `profiles`, and its subquery reads `batch_members` — a
-- DIFFERENT table, not a self-reference. The subquery itself is governed by
-- batch_members' own RLS as the ordinary `authenticated` caller, which is
-- fine: the caller can always see their own membership row, and by the same
-- roster rule (previous migration) they can see the target's row too,
-- PRECISELY WHEN the my_batch_role() check below already confirms they are
-- an active member of that same batch. No recursion, because `profiles` is
-- never queried from within a `profiles` policy.
--
-- Text comparison, not a uuid cast, on the Storage path segment: matches
-- Phase 1's avatars_select_own policy exactly, so a malformed/missing folder
-- segment yields NULL (never true) instead of raising a cast exception —
-- fails closed, never fails loudly (security.md §6 rule 3).

create policy profiles_select_shared_batch on public.profiles
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
        from public.batch_members theirs
       where theirs.profile_id = profiles.id
         and theirs.status = 'active'
         and public.my_batch_role(theirs.batch_id) is not null
    )
  );

create policy avatars_select_shared_batch on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
        from public.batch_members theirs
       where theirs.profile_id::text = (storage.foldername(name))[1]
         and theirs.status = 'active'
         and public.my_batch_role(theirs.batch_id) is not null
    )
  );
