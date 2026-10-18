-- Phase 3A — Invitations & Join.
--
-- batch_invites (database.md §3.4) and the batch_members.invite_id
-- provenance column database.md §3.3 specifies but Phase 2 deliberately
-- deferred (memory.md: "batch_members.invite_id — batch_invites does not
-- exist until Phase 3A").
--
-- RLS enabled and forced in this same migration (security.md §5.1 ground
-- rule 1). B5 standing rule (docs/memory.md, security.md §32 B5): every
-- named client role is REVOKEd by name before anything is granted back.

-- ---------------------------------------------------------------------------
-- batch_invites (database.md §3.4). Shareable invite links. The raw bearer
-- token is never stored — only token_hash, a SHA-256 digest computed by the
-- application layer (Node's crypto, not pgcrypto — no new SQL extension
-- dependency is introduced for this).
-- ---------------------------------------------------------------------------

create table public.batch_invites (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  token_hash text not null,
  max_uses integer check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint batch_invites_unique_token_hash unique (token_hash),
  constraint batch_invites_unique_id_batch unique (id, batch_id),
  constraint batch_invites_use_count_within_max
    check (max_uses is null or use_count <= max_uses)
);

comment on table public.batch_invites is
  'Shareable invite links/codes (database.md §3.4, ADR-08b). Retained for the life of the batch — never deleted on expiry (provenance trail, §16).';
comment on column public.batch_invites.token_hash is
  'SHA-256 of the raw token, computed server-side in the application layer before this row is ever written. The raw token is never stored, logged, or passed to SQL (security.md §9).';

alter table public.batch_invites enable row level security;
alter table public.batch_invites force row level security;

create trigger set_updated_at
  before update on public.batch_invites
  for each row execute function public.set_updated_at();

-- Indexes (database.md §3.4 "Indexes"; §10.1 Rule A/B).
create index batch_invites_batch_id_idx on public.batch_invites (batch_id);
create index batch_invites_created_by_idx on public.batch_invites (created_by);
create index batch_invites_revoked_by_idx
  on public.batch_invites (revoked_by)
  where revoked_by is not null;

-- ---------------------------------------------------------------------------
-- batch_members.invite_id (database.md §3.3) — invite provenance, added now
-- that batch_invites exists. `invited_by` already exists (Phase 2); only
-- `invite_id` is new here. Composite FK makes a cross-batch provenance
-- reference structurally unrepresentable (database.md §14, §3.3) — a
-- membership in batch A can never record that it came from an invite issued
-- for batch B.
-- ---------------------------------------------------------------------------

alter table public.batch_members
  add column invite_id uuid;

alter table public.batch_members
  add constraint batch_members_invite_id_fkey
  foreign key (invite_id, batch_id) references public.batch_invites (id, batch_id)
  on delete set null (invite_id);

comment on column public.batch_members.invite_id is
  'Provenance: which link brought this member in (database.md §3.3, §16). Composite FK against batch_invites(id, batch_id) — cannot point at an invite from a different batch.';

-- Sparse FK index (database.md §3.3 "Indexes"; §10.1 Rule B).
create index batch_members_invite_id_idx
  on public.batch_members (invite_id)
  where invite_id is not null;

-- ---------------------------------------------------------------------------
-- Privileges on batch_invites: RPC-only for every write, same posture as
-- batches/batch_members (security.md §5.2). Reads are admin+ of that batch,
-- EXCLUDING token_hash — a column-level privilege, not merely a policy
-- (security.md §9, "token_hash is not selectable by any client role").
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
begin
  execute 'revoke all on table public.batch_invites from public';
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public.batch_invites from %I', r);
    end if;
  end loop;
end
$$;

-- Column-level grant deliberately omits token_hash.
grant select (
  id, batch_id, max_uses, use_count, expires_at, revoked_at, revoked_by,
  created_by, created_at, updated_at
) on public.batch_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Policy. SELECT only, admin+ of the invite's own batch — no INSERT/
-- UPDATE/DELETE policy exists because no grant exists for those commands
-- (security.md §5.2, §9).
-- ---------------------------------------------------------------------------

create policy batch_invites_select_admin on public.batch_invites
  for select
  to authenticated
  using (public.my_batch_role(batch_id) >= 'admin'::public.batch_role);
