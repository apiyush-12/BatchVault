-- Phase 2 — Batch Spaces.
--
-- audit_logs (database.md §3.10) and the two atomic, privileged RPCs Phase 2
-- introduces: create_batch (security.md §5.2.1) and update_batch_settings
-- (admin+ only, audited — phases.md Phase 2 "Security work").
--
-- audit_logs read access (admin+ of a batch) is explicitly Phase 8A scope
-- ("Audit-log view for admin+ of that batch only", phases.md Phase 8A). This
-- migration creates the table with RLS enabled and forced and grants NO
-- client role any privilege on it at all — not even SELECT — matching
-- database.md §3.10 ("not exposed for direct client query") and the
-- deny-by-default posture Phase 0 used for Storage buckets before their
-- policies existed. Only the WRITE this phase needs (from inside
-- update_batch_settings, which runs as the BYPASSRLS-holding owner and needs
-- no grant) is exercised now.

-- ---------------------------------------------------------------------------
-- Enum types (database.md §"Enum types" / §3.10).
-- ---------------------------------------------------------------------------

create type public.audit_action as enum (
  'member_approved', 'member_rejected', 'member_removed', 'member_left',
  'role_changed', 'ownership_transferred',
  'invite_created', 'invite_revoked',
  'content_removed', 'content_restored',
  'report_resolved',
  'batch_settings_changed',
  'batch_deleted', 'batch_restored'
);

create type public.audit_target_kind as enum (
  'batch', 'member', 'memory', 'comment', 'media_asset', 'invite', 'report'
);

-- ---------------------------------------------------------------------------
-- audit_logs (database.md §3.10). Append-only record of privileged actions.
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  batch_id uuid references public.batches (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  actor_role public.batch_role,
  action public.audit_action not null,
  target_kind public.audit_target_kind,
  target_id uuid,
  detail jsonb
);

comment on table public.audit_logs is
  'Append-only record of privileged/contested actions (database.md §3.10). No client role holds any grant on this table at all — write happens only from inside the privileged functions that perform the audited action; read is a narrow, admin+-gated access path introduced in Phase 8A.';
comment on column public.audit_logs.target_id is
  'Deliberately no FK: an audit record must outlive its subject (database.md §3.10).';
comment on column public.audit_logs.actor_role is
  'The role held AT THE TIME of the action — a frozen historical fact, never re-derived (database.md §3.10, security.md §20).';

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

create index audit_logs_batch_occurred_idx on public.audit_logs (batch_id, occurred_at desc);
create index audit_logs_actor_occurred_idx on public.audit_logs (actor_profile_id, occurred_at desc);
create index audit_logs_target_idx on public.audit_logs (target_kind, target_id);

-- No set_updated_at trigger: audit_logs has no updated_at column — it is
-- append-only by privilege, and an updated_at would imply a lie
-- (database.md §11).

do $$
declare
  r text;
begin
  execute 'revoke all on table public.audit_logs from public';
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public.audit_logs from %I', r);
    end if;
  end loop;
end
$$;
-- No grant is added back to any client role. Nothing below this line
-- changes that: create_batch and update_batch_settings write to audit_logs
-- only because they execute as the table's BYPASSRLS-holding owner
-- (security.md §32 B2), not because of any grant.

-- ---------------------------------------------------------------------------
-- create_batch (security.md §5.2.1): atomic batch + owner-membership
-- creation. Commits both or neither — there is no explicit transaction
-- control because a PL/pgSQL function body already runs inside the caller's
-- transaction, so any failure here rolls back everything, including the
-- batches insert.
--
-- No direct INSERT grant exists on batches or batch_members (previous
-- migration) — this RPC is the only way either row comes into existence for
-- an ordinary user.
--
-- Column-length/range validation is intentionally NOT duplicated here: the
-- table's own CHECK constraints are the backstop (rules.md §3, "duplicated
-- business logic"), and the Zod schema at the Server Action boundary is the
-- friendly-error layer.
-- ---------------------------------------------------------------------------

create function public.create_batch(
  p_name text,
  p_institution_name text,
  p_course_name text default null,
  p_department_name text default null,
  p_graduation_year smallint default null,
  p_section text default null,
  p_description text default null,
  p_join_policy public.join_policy default 'invite_only_requires_approval'
)
returns public.batches
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  created public.batches;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.batches (
    name, institution_name, course_name, department_name,
    graduation_year, section, description, join_policy, created_by
  )
  values (
    p_name, p_institution_name, p_course_name, p_department_name,
    p_graduation_year, p_section, p_description, p_join_policy, caller
  )
  returning * into created;

  insert into public.batch_members (
    batch_id, profile_id, role, status, joined_at, decided_at, decided_by
  )
  values (created.id, caller, 'owner', 'active', now(), now(), caller);

  return created;
end;
$fn$;

comment on function public.create_batch(text, text, text, text, smallint, text, text, public.join_policy) is
  'Atomic create-batch-with-owner (security.md §5.2.1): a batches row without an active owner is never a reachable state.';

-- ---------------------------------------------------------------------------
-- update_batch_settings: admin+ only, audited (phases.md Phase 2; security.md
-- §11, §20). "PUT" semantics — the caller supplies the complete new settings
-- state, matching a single settings form submission; there is no per-field
-- PATCH convention to get wrong.
--
-- visibility is deliberately not a parameter: batch_visibility has exactly
-- one legal value today (database.md, ADR-12), so there is nothing to choose
-- between yet.
-- ---------------------------------------------------------------------------

create function public.update_batch_settings(
  p_batch_id uuid,
  p_name text,
  p_institution_name text,
  p_course_name text,
  p_department_name text,
  p_graduation_year smallint,
  p_section text,
  p_description text,
  p_join_policy public.join_policy
)
returns public.batches
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  previous public.batches;
  updated public.batches;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Resolved from batch_members via the membership predicate — never
  -- accepted from the caller (security.md §11 rule 1).
  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null or caller_role < 'admin'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into previous
    from public.batches
   where id = p_batch_id
     and deleted_at is null;

  if previous.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batches
     set name = p_name,
         institution_name = p_institution_name,
         course_name = p_course_name,
         department_name = p_department_name,
         graduation_year = p_graduation_year,
         section = p_section,
         description = p_description,
         join_policy = p_join_policy
   where id = p_batch_id
   returning * into updated;

  insert into public.audit_logs (
    batch_id, actor_profile_id, actor_role, action, target_kind, target_id, detail
  )
  values (
    p_batch_id, caller, caller_role, 'batch_settings_changed', 'batch', p_batch_id,
    jsonb_build_object(
      'before', jsonb_build_object(
        'name', previous.name,
        'institution_name', previous.institution_name,
        'course_name', previous.course_name,
        'department_name', previous.department_name,
        'graduation_year', previous.graduation_year,
        'section', previous.section,
        'description', previous.description,
        'join_policy', previous.join_policy
      ),
      'after', jsonb_build_object(
        'name', updated.name,
        'institution_name', updated.institution_name,
        'course_name', updated.course_name,
        'department_name', updated.department_name,
        'graduation_year', updated.graduation_year,
        'section', updated.section,
        'description', updated.description,
        'join_policy', updated.join_policy
      )
    )
  );

  return updated;
end;
$fn$;

comment on function public.update_batch_settings(uuid, text, text, text, text, smallint, text, text, public.join_policy) is
  'Admin+ batch settings change, audited in the same transaction (security.md §11, §20; phases.md Phase 2).';

-- ---------------------------------------------------------------------------
-- Minimum EXECUTE grants (security.md §5.2.2): revoke from every named
-- client role first, then grant only to authenticated. Neither function is
-- ever called anonymously or with system authority.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  fn text;
begin
  foreach fn in array array[
    'public.create_batch(text, text, text, text, smallint, text, text, public.join_policy)',
    'public.update_batch_settings(uuid, text, text, text, text, smallint, text, text, public.join_policy)'
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
