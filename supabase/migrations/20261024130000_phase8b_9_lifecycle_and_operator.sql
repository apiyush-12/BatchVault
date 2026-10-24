-- Phase 8B (batch & account lifecycle) + Phase 9 B4 (minimum operator
-- moderation). Decisions recorded first in their source documents:
--   PRD #6  soft delete, 30-day grace, owner-only, restorable, object-first reap
--   Q3/B3   account deletion blocked while caller actively owns a live batch
--   Q7      audit rows survive with batch_id NULL (existing FK; no change)
--   R3      typed confirmation, no re-authentication in MVP
--   B4      service-role-only operator removal/takedown, audited, not undoable
--           by the batch itself
--
-- B5 standing rule: every function below is REVOKEd from each named client
-- role before EXECUTE is granted back deliberately.
--
-- Execution model (security.md §32 B2): every SECURITY DEFINER function here
-- runs as the BYPASSRLS-holding owner, so its own explicit checks are the
-- ONLY authorization boundary for what it does.

-- ---------------------------------------------------------------------------
-- 1. The membership predicate must honour batch soft-deletion
--    (security.md §5.1 rule 7: "every membership predicate additionally
--    requires the batch not to be soft-deleted"). Every content policy and
--    every authorization-bearing RPC resolves the caller through this one
--    helper, so this single change makes a deleted batch invisible
--    everywhere at once — rows, roster, comments, reactions, and batch-media
--    Storage reads. CREATE OR REPLACE keeps the existing EXECUTE grants.
-- ---------------------------------------------------------------------------

create or replace function public.my_batch_role(p_batch_id uuid)
returns public.batch_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
    from public.batch_members m
    join public.batches b on b.id = m.batch_id
   where m.batch_id = p_batch_id
     and m.profile_id = auth.uid()
     and m.status = 'active'
     and b.deleted_at is null
$$;

-- ---------------------------------------------------------------------------
-- 2. Owner batch deletion (PRD #6). Typed confirmation re-validated here,
--    not just in the UI (R3). The audit row commits in the same transaction
--    as the deletion itself (security.md §20, §24).
-- ---------------------------------------------------------------------------

create function public.delete_batch(p_batch_id uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  batch_name text;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is distinct from 'owner'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select name into batch_name from public.batches
   where id = p_batch_id and deleted_at is null;

  if batch_name is null or p_confirm_name is distinct from batch_name then
    raise exception 'confirmation does not match' using errcode = '22023';
  end if;

  update public.batches set deleted_at = now() where id = p_batch_id;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id, detail)
  values (p_batch_id, caller, caller_role, 'batch_deleted', 'batch', p_batch_id,
          jsonb_build_object('grace_days', 30));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Owner restoration within the grace window. Cannot use my_batch_role()
--    (it now — correctly — returns NULL for a deleted batch), so ownership is
--    read directly. Refuses an operator takedown (B4).
-- ---------------------------------------------------------------------------

create function public.restore_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  batch_deleted_at timestamptz;
  last_deletion_by_operator boolean;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.batch_members
     where batch_id = p_batch_id and profile_id = caller
       and role = 'owner' and status = 'active'
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select deleted_at into batch_deleted_at from public.batches where id = p_batch_id;
  if batch_deleted_at is null or batch_deleted_at < now() - interval '30 days' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select coalesce((detail ->> 'operator')::boolean, false) into last_deletion_by_operator
    from public.audit_logs
   where batch_id = p_batch_id and action = 'batch_deleted'
   order by occurred_at desc, id desc
   limit 1;

  if coalesce(last_deletion_by_operator, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batches set deleted_at = null where id = p_batch_id;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id)
  values (p_batch_id, caller, 'owner', 'batch_restored', 'batch', p_batch_id);
end;
$fn$;

-- The owner's own deleted batches, for the restore UI. Ordinary batch reads
-- cannot surface these (batches_select_member requires deleted_at IS NULL).
create function public.list_my_deleted_batches()
returns table (id uuid, name text, deleted_at timestamptz, restorable_until timestamptz, restorable boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id,
         b.name,
         b.deleted_at,
         b.deleted_at + interval '30 days',
         b.deleted_at >= now() - interval '30 days'
           and not coalesce((
             select (a.detail ->> 'operator')::boolean
               from public.audit_logs a
              where a.batch_id = b.id and a.action = 'batch_deleted'
              order by a.occurred_at desc, a.id desc
              limit 1
           ), false)
    from public.batches b
    join public.batch_members m on m.batch_id = b.id
   where m.profile_id = auth.uid()
     and m.role = 'owner'
     and m.status = 'active'
     and b.deleted_at is not null
   order by b.deleted_at desc
$$;

-- ---------------------------------------------------------------------------
-- 4. Account-deletion precondition (Q3/B3: block pending transfer). The
--    Auth-admin deletion itself is service-role call site 1 (security.md
--    §12) and runs in the Server Action only after this succeeds. Deleting
--    auth.users then cascades exactly per security.md §22 (verified against
--    the live FK set): profile, memberships, reactions removed; authorship
--    on memories/comments/media/batches/invites/reports/audit set NULL.
--    A distinct, non-generic error is deliberate here: it is about the
--    caller's OWN batches, so it discloses nothing.
-- ---------------------------------------------------------------------------

create function public.prepare_account_deletion()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.batch_members m
      join public.batches b on b.id = m.batch_id
     where m.profile_id = caller
       and m.role = 'owner'
       and m.status = 'active'
       and b.deleted_at is null
  ) then
    raise exception 'owns_active_batch' using errcode = 'P0001';
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Object-first batch reaping (security.md §24; database.md §24). Three
--    service-role-only functions backing a Vercel Cron route. The 30-day
--    window is fixed here, in the database, so no caller can shorten it.
-- ---------------------------------------------------------------------------

create function public.list_reapable_batches(p_limit integer default 10)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.batches
   where deleted_at is not null
     and deleted_at < now() - interval '30 days'
   order by deleted_at
   limit greatest(1, least(coalesce(p_limit, 10), 50))
$$;

-- Every Storage object under the batch's path prefix — including orphans
-- with no media_assets row — but only for a batch actually due for reaping.
create function public.list_batch_storage_objects(p_batch_id uuid, p_limit integer default 100)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id = 'batch-media'
     and (storage.foldername(o.name))[1] = p_batch_id::text
     and exists (
       select 1 from public.batches b
        where b.id = p_batch_id
          and b.deleted_at is not null
          and b.deleted_at < now() - interval '30 days'
     )
   limit greatest(1, least(coalesce(p_limit, 100), 1000))
$$;

-- Deletes the batch row (the whole subtree cascades) ONLY when it is past
-- its window AND no Storage object remains under its prefix — the
-- object-first guarantee enforced in the database, not trusted to the
-- caller. Idempotent: returns false, never errors, if not eligible.
create function public.purge_batch(p_batch_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.batches
     where id = p_batch_id
       and deleted_at is not null
       and deleted_at < now() - interval '30 days'
  ) then
    return false;
  end if;

  if exists (
    select 1 from storage.objects
     where bucket_id = 'batch-media'
       and (storage.foldername(name))[1] = p_batch_id::text
  ) then
    return false;
  end if;

  delete from public.batches where id = p_batch_id;
  return true;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. B4 — minimum operator capability. service_role only. Audited with
--    actor NULL, detail.operator = true, and a mandatory reason.
-- ---------------------------------------------------------------------------

create function public.operator_remove_content(
  p_target_kind public.report_target_kind,
  p_target_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  resolved_batch_id uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 500 then
    raise exception 'a reason (1-500 characters) is required' using errcode = '22023';
  end if;

  if p_target_kind = 'memory' then
    update public.memories set deleted_at = now(), deleted_by = null
     where id = p_target_id and deleted_at is null
     returning batch_id into resolved_batch_id;
  elsif p_target_kind = 'comment' then
    update public.comments set deleted_at = now(), deleted_by = null
     where id = p_target_id and deleted_at is null
     returning batch_id into resolved_batch_id;
  else
    raise exception 'only memory or comment can be removed' using errcode = '22023';
  end if;

  if resolved_batch_id is null then
    raise exception 'target not found or already removed' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id, detail)
  values (resolved_batch_id, null, null, 'content_removed',
          p_target_kind::text::public.audit_target_kind, p_target_id,
          jsonb_build_object('operator', true, 'reason', p_reason));
end;
$fn$;

create function public.operator_takedown_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 500 then
    raise exception 'a reason (1-500 characters) is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.batches where id = p_batch_id) then
    raise exception 'batch not found' using errcode = 'P0002';
  end if;

  -- Keep an earlier owner deletion's timestamp if one exists, so a takedown
  -- never extends the reap window; otherwise start the window now.
  update public.batches set deleted_at = coalesce(deleted_at, now()) where id = p_batch_id;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id, detail)
  values (p_batch_id, null, null, 'batch_deleted', 'batch', p_batch_id,
          jsonb_build_object('operator', true, 'reason', p_reason, 'grace_days', 30));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 7. A batch's own moderators must not be able to undo an operator removal
--    (B4's whole point is acting when the batch cannot be trusted). Same
--    signature as Phase 8A's restore_content; CREATE OR REPLACE keeps its
--    existing EXECUTE grant to authenticated.
-- ---------------------------------------------------------------------------

create or replace function public.restore_content(
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
  removed_by_operator boolean;
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

  select coalesce((detail ->> 'operator')::boolean, false) into removed_by_operator
    from public.audit_logs
   where target_id = p_target_id and action = 'content_removed'
   order by occurred_at desc, id desc
   limit 1;

  if coalesce(removed_by_operator, false) then
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

-- ---------------------------------------------------------------------------
-- 8. Minimum EXECUTE grants (security.md §5.2.2; B5 standing rule).
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  fn text;
  user_fns text[] := array[
    'public.delete_batch(uuid, text)',
    'public.restore_batch(uuid)',
    'public.list_my_deleted_batches()',
    'public.prepare_account_deletion()'
  ];
  system_fns text[] := array[
    'public.list_reapable_batches(integer)',
    'public.list_batch_storage_objects(uuid, integer)',
    'public.purge_batch(uuid)',
    'public.operator_remove_content(public.report_target_kind, uuid, text)',
    'public.operator_takedown_batch(uuid, text)'
  ];
begin
  foreach fn in array user_fns || system_fns
  loop
    execute format('revoke all on function %s from public', fn);
    foreach r in array array['anon', 'authenticated', 'service_role']
    loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on function %s from %I', fn, r);
      end if;
    end loop;
  end loop;

  foreach fn in array user_fns
  loop
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  foreach fn in array system_fns
  loop
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end
$$;
