-- Phase 1 — Authentication & Profile.
--
-- Two narrow controlled write paths for protected system fields
-- (security.md §5.4.3), distinct from — and not an addition to — the
-- high-risk RPC-only list in §5.2:
--
--   1. complete_onboarding()          sets profiles.onboarding_completed_at
--   2. set_own_avatar_path(text)      sets profiles.avatar_path
--
-- Both are SECURITY DEFINER, schema-qualified throughout, pinned to an empty
-- search_path, contain no dynamic SQL, and derive the caller from auth.uid()
-- with an explicit NULL branch — never from a parameter (security.md §5.2.2,
-- §13). Every failure raises the same generic exception (indistinguishable
-- denial, security.md §3) and both are idempotent-safe to call again.
--
-- Execution model (docs/memory.md, security.md §32 B2 — CLOSED): the migrated
-- owner role on this project holds BYPASSRLS, so these functions bypass RLS
-- on public.profiles and storage.objects entirely once they run. Their own
-- explicit checks below are therefore the *only* authorization boundary for
-- the writes they perform — not an owner-admitting policy, which would be
-- inert here and is deliberately not written.

create or replace function public.complete_onboarding()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  updated public.profiles;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Idempotent: re-running does not rewrite an already-set completion
  -- (security.md §5.4.3's stated precondition).
  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = caller
     and deleted_at is null
   returning * into updated;

  if updated.id is null then
    -- No profile row for this caller yet, or it is soft-deleted. Same
    -- exception as every other branch — indistinguishable denial.
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return updated;
end;
$fn$;

comment on function public.complete_onboarding() is
  'Controlled write path (security.md §5.4.3): marks the caller''s OWN onboarding complete. No parameter accepts a caller-chosen value; the timestamp is always server-generated.';

create or replace function public.set_own_avatar_path(object_path text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  expected_prefix text;
  object_exists boolean;
  updated public.profiles;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- The path's first segment must equal the caller's own id (security.md
  -- §6.1) — this alone rejects another profile's object and any
  -- batch-media-shaped path, since neither starts with the caller's uuid.
  expected_prefix := caller::text || '/';
  if object_path is null
     or left(object_path, char_length(expected_prefix)) <> expected_prefix
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Re-verify the object actually exists at the path issued, the same
  -- finalize-style authoritative check media uses (architecture §8) — a path
  -- string alone proves nothing.
  select exists (
           select 1
             from storage.objects
            where bucket_id = 'avatars'
              and name = object_path
         )
    into object_exists;

  if not object_exists then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.profiles
     set avatar_path = object_path
   where id = caller
     and deleted_at is null
   returning * into updated;

  if updated.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return updated;
end;
$fn$;

comment on function public.set_own_avatar_path(text) is
  'Controlled write path (security.md §5.4.3, §6.1): records an avatar object the caller already uploaded to their own path. Exposes no other column.';

-- Minimum EXECUTE grants (security.md §5.2.2): revoke from every named client
-- role first, then grant only to authenticated. Neither function is ever
-- called anonymously or with system authority.
do $$
declare
  r text;
  fn text;
begin
  foreach fn in array array[
    'public.complete_onboarding()',
    'public.set_own_avatar_path(text)'
  ]
  loop
    execute format('revoke all on function %s from public', fn);
    foreach r in array array['anon', 'authenticated', 'service_role']
    loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on function %s from %I', fn, r);
      end if;
    end loop;
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end
$$;
