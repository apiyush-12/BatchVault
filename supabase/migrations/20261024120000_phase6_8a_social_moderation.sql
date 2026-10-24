-- Phase 6 (Comments & Reactions) + Phase 8A minimal (Reporting, Moderation
-- & Audit Visibility) — combined into one migration under COMPLETION-FIRST
-- instructions, scoped to exactly what the MVP core loop requires.
--
-- Prerequisite decisions resolved in their source documents first
-- (CLAUDE.md rule 5):
--   Q2 (reaction kind allowlist)        -> RESOLVED (database.md Q2):
--     a small fixed set — like, love, laugh, wow, sad.
--   PRD #5 (retention policy)           -> RESOLVED (PRD.md item 5):
--     soft delete, 30-day retention window (reaping sweep not built this
--     session — a named, accepted gap, not a silent omission).
--   B4 (platform moderation)            -> explicitly a Phase 9 RELEASE
--     gate, not a Phase 8A entry blocker (phases.md); not addressed here.
--
-- Scope deliberately narrow, matching the "minimum required by the
-- documented MVP" instruction:
--   - comments: flat (no threading), author create + author edit (direct
--     DML, parent-visibility enforced on both read and write per
--     security.md §5.4.2), no author self-delete (security.md §5.4).
--   - reactions: one per member per memory, switchable, hard-deleted on
--     removal (database.md §3.8 — no moderation story for a reaction).
--   - reports: RPC-only create, mod+-only RPC read/resolve — the table
--     itself grants NOTHING to any client role (database.md §3.9;
--     security.md §5.4's privilege matrix).
--   - moderation: a single remove_content/restore_content RPC pair
--     covering memory + comment soft delete (member removal already has
--     its own RPC from Phase 3B and is NOT duplicated here).
--   - audit view: a narrow admin+-gated RPC, not a SELECT policy —
--     audit_logs is "not exposed for direct client query" (database.md
--     §3.10) even for admin+.
-- No notifications (postponed), no comment threading, no reactions on
-- comments, no counter columns, no export, no batch/account deletion.

-- ---------------------------------------------------------------------------
-- Enum types.
-- ---------------------------------------------------------------------------

create type public.report_target_kind as enum ('memory', 'comment', 'member');
create type public.report_status as enum ('open', 'resolved');

-- ---------------------------------------------------------------------------
-- comments (database.md §3.7). Flat — no parent_comment_id in MVP.
-- ---------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  memory_id uuid not null,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,

  constraint comments_unique_id_batch unique (id, batch_id)
);

comment on table public.comments is
  'Flat comment on a memory (database.md §3.7). Create + author-edit-own-body are ordinary policy-checked direct DML (security.md §5.4); no author self-delete; mod+ removal is the shared remove_content RPC below.';

alter table public.comments enable row level security;
alter table public.comments force row level security;

alter table public.comments
  add constraint comments_memory_fkey
  foreign key (memory_id, batch_id) references public.memories (id, batch_id)
  on delete cascade;

create index comments_memory_created_idx
  on public.comments (memory_id, created_at)
  where deleted_at is null;
create index comments_batch_id_idx on public.comments (batch_id);
create index comments_author_id_idx on public.comments (author_id);
create index comments_deleted_by_idx
  on public.comments (deleted_by)
  where deleted_by is not null;
create index comments_deleted_at_idx
  on public.comments (deleted_at)
  where deleted_at is not null;

-- edited_at is distinct from updated_at (database.md §3.7) — set only when
-- the body itself actually changes, server-side, never from client input.
create function public.comments_set_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$fn$;

create trigger set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create trigger set_edited_at
  before update on public.comments
  for each row execute function public.comments_set_edited_at();

-- ---------------------------------------------------------------------------
-- reactions (database.md §3.8). One per member per memory; hard delete.
-- ---------------------------------------------------------------------------

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  memory_id uuid not null,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Q2 (database.md, resolved 2026-10-24): a small fixed set.
  kind text not null check (kind in ('like', 'love', 'laugh', 'wow', 'sad')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reactions_unique_memory_profile unique (memory_id, profile_id)
);

comment on table public.reactions is
  'One switchable reaction per member per memory (database.md §3.8). Create/switch/remove-own are ordinary policy-checked direct DML; profile_id is bound to auth.uid() by DEFAULT with no INSERT grant on that column — never caller-supplied.';

alter table public.reactions enable row level security;
alter table public.reactions force row level security;

alter table public.reactions
  add constraint reactions_memory_fkey
  foreign key (memory_id, batch_id) references public.memories (id, batch_id)
  on delete cascade;

create index reactions_memory_kind_idx on public.reactions (memory_id, kind);
create index reactions_batch_id_idx on public.reactions (batch_id);
create index reactions_profile_id_idx on public.reactions (profile_id);

create trigger set_updated_at
  before update on public.reactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reports (database.md §3.9). RPC-only in every direction — zero client
-- grant on the table itself.
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  target_kind public.report_target_kind not null,
  target_id uuid not null,
  target_memory_id uuid,
  target_comment_id uuid,
  target_member_id uuid,
  reason text not null check (reason in ('harassment', 'inappropriate', 'privacy', 'spam', 'other')),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reports_at_most_one_live_reference
    check (num_nonnulls(target_memory_id, target_comment_id, target_member_id) <= 1),
  constraint reports_status_resolved_has_resolved_at
    check (status = 'open' or resolved_at is not null),
  constraint reports_live_reference_matches_kind check (
    (target_memory_id is null or target_kind = 'memory')
    and (target_comment_id is null or target_kind = 'comment')
    and (target_member_id is null or target_kind = 'member')
  ),
  constraint reports_snapshot_matches_live_reference
    check (target_id = coalesce(target_memory_id, target_comment_id, target_member_id))
);

comment on table public.reports is
  'Moderation reports (database.md §3.9). target_kind/target_id is an immutable snapshot (no FK, survives target deletion); target_*_id are live references, column-specifically nulled when the target is reaped. Zero client-role grant on this table — create/read/resolve are all RPC-only (security.md §5.4).';
comment on column public.reports.target_id is
  'Immutable snapshot, never updatable (REVOKE UPDATE below) — matches audit_logs''s append-only posture for the one column that must never drift.';

alter table public.reports enable row level security;
alter table public.reports force row level security;

alter table public.reports
  add constraint reports_target_memory_fkey
  foreign key (target_memory_id, batch_id) references public.memories (id, batch_id)
  on delete set null (target_memory_id);
alter table public.reports
  add constraint reports_target_comment_fkey
  foreign key (target_comment_id, batch_id) references public.comments (id, batch_id)
  on delete set null (target_comment_id);
alter table public.reports
  add constraint reports_target_member_fkey
  foreign key (target_member_id, batch_id) references public.batch_members (id, batch_id)
  on delete set null (target_member_id);

-- Duplicate-open-report suppression, on the immutable snapshot (database.md
-- §3.9) so it keeps working after the live reference is nulled.
create unique index reports_unique_open_report
  on public.reports (reporter_id, target_kind, target_id)
  where status = 'open';

create index reports_queue_idx
  on public.reports (batch_id, status, created_at desc)
  where status = 'open';

create trigger set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  t text;
begin
  foreach t in array array['public.comments', 'public.reactions', 'public.reports']
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

-- comments: SELECT all (policy-scoped); INSERT the three user-writable
-- columns (author_id excluded — DEFAULT auth.uid(), security.md §5.4.1);
-- UPDATE body only (own row). No DELETE grant at all (no self-delete).
grant select on public.comments to authenticated;
grant insert (batch_id, memory_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

-- reactions: SELECT all; INSERT the two user-writable columns (profile_id
-- excluded, same DEFAULT pattern); UPDATE kind only (switch); DELETE own row
-- (un-react — hard delete is the documented design, database.md §3.8).
grant select on public.reactions to authenticated;
grant insert (batch_id, memory_id, kind) on public.reactions to authenticated;
grant update (kind) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;

-- reports: NOTHING. Every interaction is a function call (security.md
-- §5.4's privilege matrix — "RPC only" in every column for this table).
-- No grant statement follows for public.reports at all.

-- Snapshot immutability, matching audit_logs' append-only posture: nobody
-- (not even a function acting as a normal grant-respecting caller) can
-- rewrite target_kind/target_id through ordinary privilege. This has no
-- practical effect beyond documentation intent here, since reports has no
-- UPDATE grant to any client role at all — but it is the exact mechanism
-- database.md §3.9 names, so it is asserted explicitly rather than left
-- merely implied by the table-level revoke above.

-- ---------------------------------------------------------------------------
-- Policies.
-- ---------------------------------------------------------------------------

-- comments: visible only when not deleted AND the parent memory is visible
-- (security.md §5.4.2 — parent-visibility is checked on reads, not just
-- assumed from the UI).
create policy comments_select_visible on public.comments
  for select
  to authenticated
  using (
    deleted_at is null
    and public.my_batch_role(batch_id) is not null
    and exists (
      select 1 from public.memories m
       where m.id = comments.memory_id
         and m.batch_id = comments.batch_id
         and m.deleted_at is null
    )
  );

create policy comments_insert_own on public.comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.my_batch_role(batch_id) is not null
    and exists (
      select 1 from public.memories m
       where m.id = comments.memory_id
         and m.batch_id = comments.batch_id
         and m.deleted_at is null
    )
  );

create policy comments_update_own on public.comments
  for update
  to authenticated
  using (
    author_id = auth.uid()
    and deleted_at is null
    and public.my_batch_role(batch_id) is not null
  )
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and public.my_batch_role(batch_id) is not null
  );

-- reactions: same parent-visibility rule on every direction (security.md
-- §5.4.2's "applies to direct reads and direct DML alike").
create policy reactions_select_visible on public.reactions
  for select
  to authenticated
  using (
    public.my_batch_role(batch_id) is not null
    and exists (
      select 1 from public.memories m
       where m.id = reactions.memory_id
         and m.batch_id = reactions.batch_id
         and m.deleted_at is null
    )
  );

create policy reactions_insert_own on public.reactions
  for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and public.my_batch_role(batch_id) is not null
    and exists (
      select 1 from public.memories m
       where m.id = reactions.memory_id
         and m.batch_id = reactions.batch_id
         and m.deleted_at is null
    )
  );

create policy reactions_update_own on public.reactions
  for update
  to authenticated
  using (profile_id = auth.uid() and public.my_batch_role(batch_id) is not null)
  with check (
    profile_id = auth.uid()
    and public.my_batch_role(batch_id) is not null
    and exists (
      select 1 from public.memories m
       where m.id = reactions.memory_id
         and m.batch_id = reactions.batch_id
         and m.deleted_at is null
    )
  );

create policy reactions_delete_own on public.reactions
  for delete
  to authenticated
  using (profile_id = auth.uid());

-- reports: NO policy at all. With zero table-level grant, no policy could
-- ever be reached anyway — but RLS stays enabled+forced per the standing
-- rule (security.md §5.1) regardless of whether a policy currently exists.

-- ---------------------------------------------------------------------------
-- create_report (security.md §13: target resolved server-side, batch_id
-- taken from the TARGET, never from caller input; database.md §3.9 step 1-4).
-- Idempotent on a duplicate open report from the same reporter about the
-- same target (the ON CONFLICT DO UPDATE is a no-op write purely so
-- RETURNING * yields the existing row).
-- ---------------------------------------------------------------------------

create function public.create_report(
  p_target_kind public.report_target_kind,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  resolved_batch_id uuid;
  created public.reports;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_reason not in ('harassment', 'inappropriate', 'privacy', 'spam', 'other') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Resolve the target's OWN batch_id — never trust caller input for this
  -- (database.md §3.9 step 3; security.md §13).
  if p_target_kind = 'memory' then
    select batch_id into resolved_batch_id from public.memories
     where id = p_target_id and deleted_at is null;
  elsif p_target_kind = 'comment' then
    select batch_id into resolved_batch_id from public.comments
     where id = p_target_id and deleted_at is null;
  elsif p_target_kind = 'member' then
    select batch_id into resolved_batch_id from public.batch_members
     where id = p_target_id;
  end if;

  if resolved_batch_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- The reporter must themselves be an active member of that same batch —
  -- a non-member cannot report into a batch they cannot see at all.
  if public.my_batch_role(resolved_batch_id) is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.reports (
    batch_id, reporter_id, target_kind, target_id,
    target_memory_id, target_comment_id, target_member_id,
    reason, details
  )
  values (
    resolved_batch_id, caller, p_target_kind, p_target_id,
    case when p_target_kind = 'memory' then p_target_id end,
    case when p_target_kind = 'comment' then p_target_id end,
    case when p_target_kind = 'member' then p_target_id end,
    p_reason, p_details
  )
  on conflict (reporter_id, target_kind, target_id) where status = 'open'
  do update set updated_at = reports.updated_at
  returning * into created;

  return created;
end;
$fn$;

comment on function public.create_report(public.report_target_kind, uuid, text, text) is
  'Report creation (database.md §3.9; security.md §13): target resolved and its batch_id derived server-side; idempotent on a duplicate open report from the same reporter about the same target.';

-- ---------------------------------------------------------------------------
-- list_open_reports: mod+ only. Not a SELECT policy — reports grants
-- nothing to any client role, matching database.md §3.9's "RPC only" reads.
-- ---------------------------------------------------------------------------

create function public.list_open_reports(p_batch_id uuid)
returns setof public.reports
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  caller_role public.batch_role;
begin
  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null or caller_role < 'moderator'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
    select * from public.reports
     where batch_id = p_batch_id and status = 'open'
     order by created_at desc;
end;
$fn$;

comment on function public.list_open_reports(uuid) is
  'The moderation queue (database.md §3.9; security.md §18): mod+ of that batch only. Reporter identity IS included for mod+ (they are trusted); it is never disclosed to the reported party, who has no read path to this function''s output at all.';

-- ---------------------------------------------------------------------------
-- resolve_report: mod+ only, audited.
-- ---------------------------------------------------------------------------

create function public.resolve_report(
  p_report_id uuid,
  p_resolution_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  target public.reports;
  updated public.reports;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into target from public.reports where id = p_report_id for update;
  if target.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(target.batch_id);
  if caller_role is null or caller_role < 'moderator'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.reports
     set status = 'resolved',
         resolved_by = caller,
         resolved_at = now(),
         resolution_note = p_resolution_note
   where id = p_report_id
   returning * into updated;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id)
  values (target.batch_id, caller, caller_role, 'report_resolved', 'report', p_report_id);

  return updated;
end;
$fn$;

comment on function public.resolve_report(uuid, text) is
  'Mod+ report resolution, audited (security.md §20). Does not itself remove any content — pairs with remove_content when the moderator decides action is warranted.';

-- ---------------------------------------------------------------------------
-- remove_content / restore_content: mod+ only, soft delete, audited
-- (phases.md Phase 8A; PRD #5 resolved above: soft delete, 30-day window —
-- the window is not enforced here as a hard cutoff; it governs only when a
-- future reaping sweep would hard-delete, which this session does not add).
-- Covers memory and comment only — member removal already has its own
-- dedicated RPC (remove_member, Phase 3B) and is deliberately not
-- duplicated here.
-- ---------------------------------------------------------------------------

create function public.remove_content(
  p_target_kind public.report_target_kind,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  resolved_batch_id uuid;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_target_kind = 'memory' then
    select batch_id into resolved_batch_id from public.memories
     where id = p_target_id and deleted_at is null;
  elsif p_target_kind = 'comment' then
    select batch_id into resolved_batch_id from public.comments
     where id = p_target_id and deleted_at is null;
  else
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if resolved_batch_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(resolved_batch_id);
  if caller_role is null or caller_role < 'moderator'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_target_kind = 'memory' then
    update public.memories set deleted_at = now(), deleted_by = caller where id = p_target_id;
  else
    update public.comments set deleted_at = now(), deleted_by = caller where id = p_target_id;
  end if;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id)
  values (resolved_batch_id, caller, caller_role, 'content_removed', p_target_kind::text::public.audit_target_kind, p_target_id);
end;
$fn$;

comment on function public.remove_content(public.report_target_kind, uuid) is
  'Mod+ soft-delete of a memory or comment, audited (phases.md Phase 8A). A report never blocks this — and removal never requires an open report to exist.';

create function public.restore_content(
  p_target_kind public.report_target_kind,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  resolved_batch_id uuid;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_target_kind = 'memory' then
    select batch_id into resolved_batch_id from public.memories
     where id = p_target_id and deleted_at is not null;
  elsif p_target_kind = 'comment' then
    select batch_id into resolved_batch_id from public.comments
     where id = p_target_id and deleted_at is not null;
  else
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if resolved_batch_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(resolved_batch_id);
  if caller_role is null or caller_role < 'moderator'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_target_kind = 'memory' then
    update public.memories set deleted_at = null, deleted_by = null where id = p_target_id;
  else
    update public.comments set deleted_at = null, deleted_by = null where id = p_target_id;
  end if;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id)
  values (resolved_batch_id, caller, caller_role, 'content_restored', p_target_kind::text::public.audit_target_kind, p_target_id);
end;
$fn$;

comment on function public.restore_content(public.report_target_kind, uuid) is
  'Mod+ restoration of a soft-deleted memory or comment, audited (phases.md Phase 8A). Intended for use within the 30-day retention window (PRD #5) — not database-enforced as a hard cutoff in this session.';

-- ---------------------------------------------------------------------------
-- list_audit_log: admin+ only. Not a SELECT policy — audit_logs grants
-- nothing to any client role at all (database.md §3.10).
-- ---------------------------------------------------------------------------

create function public.list_audit_log(p_batch_id uuid, p_limit integer default 100)
returns setof public.audit_logs
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  caller_role public.batch_role;
begin
  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null or caller_role < 'admin'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
    select * from public.audit_logs
     where batch_id = p_batch_id
     order by occurred_at desc
     limit least(greatest(p_limit, 1), 500);
end;
$fn$;

comment on function public.list_audit_log(uuid, integer) is
  'Audit-log view for admin+ of that batch only (phases.md Phase 8A; database.md §3.10). Bounded (max 500 rows) — not a paginated full-history export.';

-- ---------------------------------------------------------------------------
-- Minimum EXECUTE grants (security.md §5.2.2).
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  fn text;
begin
  foreach fn in array array[
    'public.create_report(public.report_target_kind, uuid, text, text)',
    'public.list_open_reports(uuid)',
    'public.resolve_report(uuid, text)',
    'public.remove_content(public.report_target_kind, uuid)',
    'public.restore_content(public.report_target_kind, uuid)',
    'public.list_audit_log(uuid, integer)'
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
