-- Phase 1 — Authentication & Profile.
--
-- profiles (database.md §3.1): one row per authenticated user. RLS enabled
-- and forced in this same migration (security.md §5.1 ground rule 1).
--
-- Column-level enforcement (security.md §5.4.1): display_name and bio are the
-- only ordinarily-writable columns. `id` is immutable — defaulted from
-- auth.uid() and never grantable on INSERT — and avatar_path /
-- onboarding_completed_at are protected system fields with their own
-- controlled write paths (§5.4.3), created in the next migration.
--
-- B5 standing rule (docs/memory.md, security.md §32 B5 finding): Supabase's
-- hosted-project default privileges grant anon/authenticated/service_role
-- full DML on every new public table, and a PUBLIC-only revoke does not
-- remove that. Every migration must REVOKE from the named client roles by
-- name before granting back deliberately.

create table public.profiles (
  id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_path text,
  bio text check (char_length(bio) <= 500),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.profiles is
  'Application-side user record, one row per authenticated user (database.md §3.1). Email lives in auth.users, not here.';

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges. Revoke the hosted-project default grant from every named
-- client role, then grant back only the ordinary "profile self-service"
-- surface security.md §5.4 documents: create own row at signup, edit own
-- display_name/bio. No DELETE grant anywhere — account deletion is a
-- privileged flow (security.md §22), not built in this phase.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
begin
  execute 'revoke all on table public.profiles from public';

  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public.profiles from %I', r);
    end if;
  end loop;
end
$$;

-- avatar_path, onboarding_completed_at, created_at, updated_at and deleted_at
-- are deliberately excluded from every grant below — none of them is
-- ordinarily writable, and deleted_at is excluded from SELECT too, since a
-- soft-deleted row should never surface even indirectly through this column.
grant select (id, display_name, avatar_path, bio, onboarding_completed_at, created_at, updated_at)
  on public.profiles to authenticated;
grant insert (display_name, bio) on public.profiles to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Policies. Separate per command (security.md §5.1 ground rule 3). Every
-- policy also carries a write-side check, not just a read filter.
-- ---------------------------------------------------------------------------

-- SELECT: own row only. The "other profiles where a batch is shared" clause
-- (security.md §5.4) is added in Phase 2 — batch_members does not exist yet
-- (phases.md Phase 1, "Explicitly NOT in scope").
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using (id = auth.uid() and deleted_at is null);

-- INSERT: own row only, at signup. `id` has no INSERT grant and defaults to
-- auth.uid(), so this WITH CHECK is defense in depth (architecture §5 Layer
-- 2), not the only control — the column grant above is what actually decides
-- whether a caller-supplied id is even accepted.
create policy profiles_insert_own on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- UPDATE: own row only. The column grants above are what actually restrict
-- which fields change (security.md §5.4.1) — this policy governs the row.
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());

-- No DELETE policy and no DELETE grant: nobody can delete a profile through
-- ordinary DML (security.md §5.4, "None (account deletion is a privileged
-- flow, §22)").
