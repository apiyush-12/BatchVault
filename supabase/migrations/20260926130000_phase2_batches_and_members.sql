-- Phase 2 — Batch Spaces.
--
-- batches + batch_members (database.md §3.2–3.3), the membership predicate
-- helper (security.md §5.3), and their read-side RLS policies. RLS enabled
-- and forced in this same migration (security.md §5.1 ground rule 1).
--
-- Deliberately deferred to a later phase, per database.md itself:
--   - batches.cover_media_asset_id       — media_assets does not exist until
--                                          Phase 4A; added by ALTER TABLE then.
--   - batch_members.invite_id            — batch_invites does not exist until
--                                          Phase 3A; the column (and its
--                                          composite FK to batch_invites(id,
--                                          batch_id)) is added by ALTER TABLE
--                                          then, not approximated here.
-- Every other column and constraint database.md specifies for these two
-- tables is created now.
--
-- B5 standing rule (docs/memory.md, security.md §32 B5): hosted Supabase's
-- default privileges grant anon/authenticated/service_role full DML on every
-- new public table. Every table below is REVOKEd from each named role by
-- name before anything is granted back deliberately.
--
-- Q1 (database.md, resolved this phase): join_policy defaults to
-- 'invite_only_requires_approval' and is owner/admin-configurable
-- (docs/PRD.md unresolved #1-2, now resolved).

-- ---------------------------------------------------------------------------
-- Enum types (database.md §"Enum types" — declaration order is load-bearing
-- for batch_role; database.md §15).
-- ---------------------------------------------------------------------------

create type public.batch_role as enum ('member', 'moderator', 'admin', 'owner');
create type public.membership_status as enum ('pending', 'active', 'rejected', 'removed', 'left');
create type public.batch_visibility as enum ('private');
create type public.join_policy as enum ('invite_only_auto_approve', 'invite_only_requires_approval');

comment on type public.batch_role is
  'Ascending capability order: member < moderator < admin < owner (database.md §15). Postgres compares enums by declaration order — this ordering is what makes role >= ''admin'' work as a ceiling check.';
comment on type public.batch_visibility is
  'Single value today by design (database.md, ADR-12): a future opt-in showcase is an explicit publication, never a relaxation of this value.';

-- ---------------------------------------------------------------------------
-- batches (database.md §3.2). Root of every privacy scope.
-- ---------------------------------------------------------------------------

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  institution_name text not null check (char_length(institution_name) between 1 and 200),
  course_name text check (char_length(course_name) <= 200),
  department_name text check (char_length(department_name) <= 200),
  graduation_year smallint check (graduation_year between 1900 and 2200),
  section text check (char_length(section) <= 40),
  description text check (char_length(description) <= 2000),
  visibility public.batch_visibility not null default 'private',
  join_policy public.join_policy not null default 'invite_only_requires_approval',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.batches is
  'The Batch Space; root of every privacy scope (database.md §3.2). No owner_id column — ownership is a role, held in batch_members.';
comment on column public.batches.created_by is
  'Immutable historical fact ("who started this batch") — never an authorization input (database.md §3.2).';

alter table public.batches enable row level security;
alter table public.batches force row level security;

create trigger set_updated_at
  before update on public.batches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- batch_members (database.md §3.3). The hottest table in the system.
-- ---------------------------------------------------------------------------

create table public.batch_members (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.batch_role not null default 'member',
  status public.membership_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint batch_members_unique_batch_profile unique (batch_id, profile_id),
  constraint batch_members_unique_id_batch unique (id, batch_id),
  constraint batch_members_owner_is_active check (role <> 'owner' or status = 'active'),
  constraint batch_members_active_has_joined_at check (status <> 'active' or joined_at is not null),
  constraint batch_members_decision_has_decided_at
    check (status not in ('rejected', 'removed') or decided_at is not null)
);

comment on table public.batch_members is
  'Membership, role, and join state (database.md §3.3). Subsumes join requests via status — no separate join-request table. Rows are never deleted while the batch lives; removal is a status transition (Phase 3B).';

-- At most one active owner per batch (database.md §3.3) — Postgres cannot
-- enforce "at least one" (database.md Q3/B3), only "at most one."
create unique index batch_members_one_active_owner
  on public.batch_members (batch_id)
  where role = 'owner' and status = 'active';

alter table public.batch_members enable row level security;
alter table public.batch_members force row level security;

create trigger set_updated_at
  before update on public.batch_members
  for each row execute function public.set_updated_at();

-- Indexes (database.md §3.3 "Indexes"; §10.1 Rule B for the sparse FKs).
create index batch_members_profile_status_idx on public.batch_members (profile_id, status);
create index batch_members_batch_status_idx on public.batch_members (batch_id, status);
create index batch_members_invited_by_idx on public.batch_members (invited_by) where invited_by is not null;
create index batch_members_decided_by_idx on public.batch_members (decided_by) where decided_by is not null;

-- ---------------------------------------------------------------------------
-- The membership predicate helper (security.md §5.3; architecture §5, §17).
--
-- Answers exactly one question for the CURRENT caller: "what is my role in
-- this batch, if I am an active member of it?" Returns NULL otherwise —
-- never distinguishing "no such batch" from "not a member of it"
-- (indistinguishable denial, security.md §3).
--
-- SECURITY DEFINER because this project's postgres owner holds BYPASSRLS
-- (security.md §32 B2 — verified, not assumed): the function's own query
-- against batch_members bypasses RLS entirely, which is what avoids the
-- self-referential recursion a SECURITY INVOKER helper would hit when used
-- inside batch_members' own policy (54001, stack depth exceeded).
--
-- Current-caller only — no user-id parameter, so it cannot be turned into an
-- oracle for "is THAT person a member of THAT batch" (security.md §5.3).
-- Schema-qualified, pinned empty search_path, no dynamic SQL, STABLE.
-- ---------------------------------------------------------------------------

create function public.my_batch_role(p_batch_id uuid)
returns public.batch_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
    from public.batch_members
   where batch_members.batch_id = p_batch_id
     and profile_id = auth.uid()
     and status = 'active'
$$;

comment on function public.my_batch_role(uuid) is
  'The membership predicate (security.md §5.3): the caller''s own active role in p_batch_id, or NULL. Current-caller only; never accepts a user id.';

do $$
declare
  r text;
begin
  execute 'revoke all on function public.my_batch_role(uuid) from public';
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function public.my_batch_role(uuid) from %I', r);
    end if;
  end loop;
end
$$;

grant execute on function public.my_batch_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges. batches and batch_members are RPC-only for every write
-- (security.md §5.2, §5.4) — no INSERT/UPDATE/DELETE grant to any client
-- role, so a direct PostgREST write is refused at the privilege level before
-- any policy is even consulted. Reads are ordinary, policy-governed SELECT.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  t text;
begin
  foreach t in array array['public.batches', 'public.batch_members']
  loop
    execute format('revoke all on table %s from public', t);
    foreach r in array array['anon', 'authenticated', 'service_role']
    loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on table %s from %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;

grant select on public.batches to authenticated;
grant select on public.batch_members to authenticated;

-- ---------------------------------------------------------------------------
-- Policies. SELECT only — no INSERT/UPDATE/DELETE policy exists because no
-- grant exists for those commands on either table (security.md §5.2).
-- ---------------------------------------------------------------------------

-- Members of that batch can read it; a soft-deleted batch is invisible to
-- everyone (security.md §5.4). No unauthenticated invite-landing read here
-- — that minimal, function-mediated exception is Phase 3A scope.
create policy batches_select_member on public.batches
  for select
  to authenticated
  using (deleted_at is null and public.my_batch_role(id) is not null);

-- Own row always visible (covers "a pending requester sees only their own
-- row"); the full roster is visible once the caller is themselves an ACTIVE
-- member of that batch (security.md §5.4).
create policy batch_members_select_own_or_roster on public.batch_members
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.my_batch_role(batch_id) is not null
  );
