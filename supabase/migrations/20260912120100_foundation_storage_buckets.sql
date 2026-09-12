-- Phase 0 — Foundation.
--
-- The two MVP Storage buckets (architecture §7; security.md §6).
--
-- Both are PRIVATE. There is no MVP configuration in which an unauthenticated
-- URL returns batch content, and no bucket is ever made public.
--
--   batch-media  photos, videos, posters, future derivatives
--                path shape {batch_id}/{media_asset_id}
--   avatars      profile images
--                path shape {profile_id}/{asset_id}
--
-- The future showcase bucket is deliberately NOT created (ADR-12): publication
-- will be an explicit copy into a separate bucket, never a permission
-- relaxation on private storage.
--
-- NO Storage policies are created here, and that is the point. Deny-by-default
-- is correct at this phase: with RLS active on storage.objects and no
-- permissive policy, no client role can read, write or delete anything. The
-- real policies land with the flows they protect — avatars in Phase 1
-- (security.md §6.1), batch media in Phase 4A (security.md §6.2, §7.1), where
-- they must reflect the object's database state and not membership alone.

insert into storage.buckets (id, name, public)
values
  ('batch-media', 'batch-media', false),
  ('avatars', 'avatars', false)
on conflict (id) do update
  set public = false;
