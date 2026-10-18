-- Phase 3B — Membership Decisions & Roles.
--
-- No new tables (phases.md Phase 3B: "status/role transitions on
-- batch_members plus audit rows"). Five privileged RPCs, each
-- SECURITY DEFINER, schema-qualified, pinned empty search_path, no dynamic
-- SQL, caller derived from auth.uid() with an explicit NULL branch
-- (security.md §5.2.2, §13): approve_member, reject_member, remove_member,
-- change_member_role, transfer_ownership.
--
-- Every function returns `public.batch_members` directly (not a
-- RETURNS TABLE of named columns) — that table has no column needing
-- exclusion the way batch_invites.token_hash does, so there is no reason to
-- repeat Phase 3A's RETURNS-TABLE/OUT-parameter ambiguity hazard here.
--
-- Identity of the target is (p_batch_id, p_target_profile_id) throughout —
-- not the batch_members row id — matching what the roster UI already
-- exposes (features/memberships's RosterMember.profileId) and keeping every
-- RPC naturally batch-scoped.
--
-- The single ceiling comparison this migration leans on everywhere
-- (security.md §4's capability matrix, §11 rules 1–2): an actor may act on
-- a target only if `caller_role > target.role`, and may only ASSIGN a role
-- if `caller_role > p_new_role`. One rule correctly reproduces every row of
-- the matrix, including a moderator's effective zero capability for role
-- changes (moderator can only "assign" ranks below moderator, i.e. member —
-- a no-op) — not three special-cased rules per actor tier.

-- ---------------------------------------------------------------------------
-- profiles_select_pending_review — a narrow, additive extension to Phase 2's
-- shared-batch profile policy, required for THIS phase's own feature to be
-- usable: Phase 2's `profiles_select_shared_batch` only admits a target
-- whose membership `status = 'active'` (security.md §5.4, §6.1), so a mod+
-- reviewing the pending-approval queue could not otherwise see a pending
-- requester's name at all — approving a request you cannot identify is not
-- a usable feature. Scoped exactly to that need: mod+ of the SAME batch,
-- target status strictly 'pending'. Safe against the recursion trap for
-- the identical reason Phase 2's policy documents (my_batch_role() reads a
-- different table, batch_members, not profiles).
-- ---------------------------------------------------------------------------

create policy profiles_select_pending_review on public.profiles
  for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
        from public.batch_members theirs
       where theirs.profile_id = profiles.id
         and theirs.status = 'pending'
         and public.my_batch_role(theirs.batch_id) >= 'moderator'::public.batch_role
    )
  );

-- ---------------------------------------------------------------------------
-- approve_member — mod+ only (security.md §4 "Approve / reject join
-- requests"). Legal transition is pending -> active only; no caller-
-- supplied status (security.md §11 rule 1).
-- ---------------------------------------------------------------------------

create function public.approve_member(p_batch_id uuid, p_target_profile_id uuid)
returns public.batch_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  updated public.batch_members;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null or caller_role < 'moderator'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batch_members bm
     set status = 'active', joined_at = now(), decided_at = now(), decided_by = caller
   where bm.batch_id = p_batch_id
     and bm.profile_id = p_target_profile_id
     and bm.status = 'pending'
   returning * into updated;

  if updated.id is null then
    -- No such pending request — refused the same way as every other
    -- unauthorized/illegal-transition case (security.md §3).
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id)
  values (p_batch_id, caller, caller_role, 'member_approved', 'member', updated.id);

  return updated;
end;
$fn$;

comment on function public.approve_member(uuid, uuid) is
  'Mod+ approves a pending join request: pending -> active only (security.md §4, §10, §11, §20).';

-- ---------------------------------------------------------------------------
-- reject_member — mod+ only. Legal transition is pending -> rejected only.
-- ---------------------------------------------------------------------------

create function public.reject_member(p_batch_id uuid, p_target_profile_id uuid)
returns public.batch_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  updated public.batch_members;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null or caller_role < 'moderator'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batch_members bm
     set status = 'rejected', decided_at = now(), decided_by = caller
   where bm.batch_id = p_batch_id
     and bm.profile_id = p_target_profile_id
     and bm.status = 'pending'
   returning * into updated;

  if updated.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id)
  values (p_batch_id, caller, caller_role, 'member_rejected', 'member', updated.id);

  return updated;
end;
$fn$;

comment on function public.reject_member(uuid, uuid) is
  'Mod+ rejects a pending join request: pending -> rejected only (security.md §4, §10, §11, §20).';

-- ---------------------------------------------------------------------------
-- remove_member — rank-ceiling gated (security.md §4 "Remove a member":
-- Owner all, Admin not-peer-admin/owner, Moderator member-only). Legal
-- transition is active -> removed only. Self-removal is not this
-- operation's scope (no self-leave RPC exists this phase).
-- ---------------------------------------------------------------------------

create function public.remove_member(p_batch_id uuid, p_target_profile_id uuid)
returns public.batch_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  target public.batch_members;
  updated public.batch_members;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_target_profile_id = caller then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null or caller_role < 'moderator'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select bm.* into target
    from public.batch_members bm
   where bm.batch_id = p_batch_id
     and bm.profile_id = p_target_profile_id
     and bm.status = 'active'
     for update;

  if target.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Ceiling: no one may act on a peer or superior (security.md §4, §11
  -- rule 4). Moderator (rank 1) clears this only against member (rank 0) —
  -- exactly "member only".
  if caller_role <= target.role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batch_members bm
     set status = 'removed', decided_at = now(), decided_by = caller
   where bm.id = target.id
   returning * into updated;

  insert into public.audit_logs (batch_id, actor_profile_id, actor_role, action, target_kind, target_id)
  values (p_batch_id, caller, caller_role, 'member_removed', 'member', updated.id);

  return updated;
end;
$fn$;

comment on function public.remove_member(uuid, uuid) is
  'Rank-ceiling-gated member removal: active -> removed only (security.md §4, §11, §20).';

-- ---------------------------------------------------------------------------
-- change_member_role — admin+ only in practice, via the ceiling rule
-- (security.md §4 "Promote/demote to moderator"/"...to admin"; §11 rules
-- 1-3). Ownership is never assigned through this path (database.md §13);
-- p_new_role = 'owner' is refused outright, for every actor.
-- ---------------------------------------------------------------------------

create function public.change_member_role(
  p_batch_id uuid,
  p_target_profile_id uuid,
  p_new_role public.batch_role
)
returns public.batch_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  target public.batch_members;
  updated public.batch_members;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_new_role = 'owner'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- No self-service role change in either direction (security.md §11 rule
  -- 3) — the one sanctioned exception is ownership transfer, a different
  -- function entirely.
  if p_target_profile_id = caller then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select bm.* into target
    from public.batch_members bm
   where bm.batch_id = p_batch_id
     and bm.profile_id = p_target_profile_id
     and bm.status = 'active'
     for update;

  if target.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- The one ceiling comparison that reproduces the whole matrix: the actor
  -- must outrank the target's CURRENT role, and must outrank the role being
  -- ASSIGNED (security.md §4 rule 2, §11 rules 1-2). A moderator (rank 1)
  -- never clears "outrank the assigned role" for any role above member,
  -- which is exactly "Moderator: cannot promote/demote" in the matrix.
  if caller_role <= target.role or caller_role <= p_new_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batch_members bm
     set role = p_new_role
   where bm.id = target.id
   returning * into updated;

  insert into public.audit_logs (
    batch_id, actor_profile_id, actor_role, action, target_kind, target_id, detail
  )
  values (
    p_batch_id, caller, caller_role, 'role_changed', 'member', updated.id,
    jsonb_build_object('previous_role', target.role, 'new_role', p_new_role)
  );

  return updated;
end;
$fn$;

comment on function public.change_member_role(uuid, uuid, public.batch_role) is
  'Rank-ceiling-gated role change (security.md §4, §11). Never assigns owner; never self-service.';

-- ---------------------------------------------------------------------------
-- transfer_ownership — owner only, one atomic operation (security.md §11
-- "Ownership transfer is a dedicated atomic operation"; database.md §13).
-- Demotes the outgoing owner FIRST: the partial unique index enforcing at
-- most one active owner (Phase 2 migration) is a plain unique INDEX, not a
-- DEFERRABLE constraint, so it is checked immediately per statement —
-- promoting the new owner before demoting the old one would violate it
-- mid-transaction. A failure anywhere rolls back the whole function body,
-- since it runs inside the caller's own transaction.
-- ---------------------------------------------------------------------------

create function public.transfer_ownership(p_batch_id uuid, p_new_owner_profile_id uuid)
returns public.batch_members
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  target public.batch_members;
  demoted public.batch_members;
  promoted public.batch_members;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_new_owner_profile_id = caller then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null or caller_role <> 'owner'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select bm.* into target
    from public.batch_members bm
   where bm.batch_id = p_batch_id
     and bm.profile_id = p_new_owner_profile_id
     and bm.status = 'active'
     for update;

  if target.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batch_members bm
     set role = 'admin'
   where bm.batch_id = p_batch_id
     and bm.profile_id = caller
     and bm.role = 'owner'
     and bm.status = 'active'
   returning * into demoted;

  if demoted.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.batch_members bm
     set role = 'owner'
   where bm.id = target.id
   returning * into promoted;

  insert into public.audit_logs (
    batch_id, actor_profile_id, actor_role, action, target_kind, target_id, detail
  )
  values (
    p_batch_id, caller, 'owner', 'ownership_transferred', 'member', promoted.id,
    jsonb_build_object(
      'previous_owner_profile_id', caller,
      'new_owner_profile_id', p_new_owner_profile_id
    )
  );

  return promoted;
end;
$fn$;

comment on function public.transfer_ownership(uuid, uuid) is
  'Owner-only atomic ownership transfer: demote-then-promote in one transaction, audited (security.md §11; database.md §13).';

-- ---------------------------------------------------------------------------
-- Minimum EXECUTE grants (security.md §5.2.2): revoke from every named
-- client role first, then grant only to authenticated.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  fn text;
begin
  foreach fn in array array[
    'public.approve_member(uuid, uuid)',
    'public.reject_member(uuid, uuid)',
    'public.remove_member(uuid, uuid)',
    'public.change_member_role(uuid, uuid, public.batch_role)',
    'public.transfer_ownership(uuid, uuid)'
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
