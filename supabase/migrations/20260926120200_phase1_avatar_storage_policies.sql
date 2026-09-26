-- Phase 1 — Authentication & Profile.
--
-- Avatar Storage policy: self only at this phase (phases.md Phase 1;
-- security.md §6.1). The co-member visibility clause depends on
-- batch_members, which does not exist until Phase 2, and is not
-- approximated here.
--
-- Path shape is `{profile_id}/{asset_id}` (security.md §6) — profile-scoped,
-- with no batch id in it at all, so this is authorized independently of the
-- batch-media predicate. `storage.foldername(name)` fails closed: a malformed
-- or missing folder segment yields NULL, and NULL = auth.uid()::text is never
-- true, so the policy denies rather than falling through to a permissive
-- branch (security.md §6 rule 3).
--
-- The batch-media bucket is untouched here and remains policy-less
-- (deny-by-default) — that bucket's policies are Phase 4A scope.

create policy avatars_select_own on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_insert_own on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- "A user may read and manage their own avatar objects" (security.md §6.1):
-- update/delete are included so a member can replace or remove their own
-- avatar directly. Both remain strictly self-scoped by the same predicate.
create policy avatars_update_own on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
