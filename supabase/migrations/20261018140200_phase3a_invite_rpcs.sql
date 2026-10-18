-- Phase 3A — Invitations & Join.
--
-- The privileged RPCs this phase introduces (security.md §5.2 list):
-- invite creation, invite revocation, and invite redemption/membership
-- creation. Plus validate_invite, the "deliberately minimal unauthenticated
-- read for invite landing" security.md §5.4's batches row already names as
-- a function-mediated exception — name only, never by opening the table.
--
-- All SECURITY DEFINER, schema-qualified, pinned empty search_path, no
-- dynamic SQL, caller derived from auth.uid() with an explicit NULL branch
-- where authentication is required (security.md §5.2.2, §13).
--
-- Hashing is deliberately NOT done in SQL: the raw token is generated and
-- hashed with Node's crypto in the Server Action, and only p_token_hash
-- ever reaches these functions. This keeps the one place that handles the
-- raw bearer credential in the application layer and avoids introducing a
-- pgcrypto dependency this schema has never otherwise needed.
--
-- A RETURNS TABLE of named columns is used for create_invite/revoke_invite
-- instead of `returns public.batch_invites`, specifically so token_hash can
-- never be included in what the client gets back — the column-level GRANT
-- in the previous migration only restricts direct table SELECTs, not a
-- function's own result shape, so this exclusion has to be deliberate here.

-- ---------------------------------------------------------------------------
-- check_invite_rate_limit: private helper, not a public RPC. Enforces
-- security.md §17's "Invite redemption | ... | IP and account" rate limit.
-- No grant to any client role — only validate_invite/redeem_invite call it,
-- and a SECURITY DEFINER function's nested calls already run as its owner.
-- ---------------------------------------------------------------------------

create function public.check_invite_rate_limit(p_ip text, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  hit_count integer;
begin
  -- Bounded cleanup: this table is low-volume and append-only, so a plain
  -- unconditional prune on every call keeps it bounded without a separate
  -- cron sweep (architecture §13's sweeps are for Storage orphans, a
  -- different concern).
  delete from public.invite_redemption_attempts
   where attempted_at < now() - interval '1 day';

  select count(*) into hit_count
    from public.invite_redemption_attempts
   where attempted_at > now() - interval '15 minutes'
     and (
       (p_ip is not null and ip = p_ip)
       or (p_profile_id is not null and profile_id = p_profile_id)
     );

  -- Same generic failure as an invalid token (security.md §17: "failures
  -- return a generic response that does not distinguish 'wrong token' from
  -- 'too many attempts'").
  if hit_count >= 20 then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.invite_redemption_attempts (ip, profile_id) values (p_ip, p_profile_id);
end;
$fn$;

comment on function public.check_invite_rate_limit(text, uuid) is
  'Private rate-limit helper for invite validation/redemption (security.md §17). Not exposed to any client role.';

-- ---------------------------------------------------------------------------
-- validate_invite: the minimal unauthenticated-until-valid read for the
-- invite landing page (security.md §5.4, §9: "batch name only, after the
-- token validates. No member list, no member count, no media, no
-- description"). Deliberately callable by BOTH anon and authenticated — a
-- recipient has not necessarily signed in yet when they land on this page
-- (PRD Journey C). Mutates nothing: use_count only moves inside redemption.
-- ---------------------------------------------------------------------------

create function public.validate_invite(p_token_hash text, p_ip text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  invite record;
begin
  perform public.check_invite_rate_limit(p_ip, caller);

  select bi.id, bi.revoked_at, bi.expires_at, bi.max_uses, bi.use_count,
         b.name as batch_name, b.deleted_at as batch_deleted_at
    into invite
    from public.batch_invites bi
    join public.batches b on b.id = bi.batch_id
   where bi.token_hash = p_token_hash;

  -- One indistinguishable generic failure for every invalid reason — never
  -- found, revoked, expired, exhausted, or the batch itself soft-deleted
  -- (security.md §9: "must not reveal whether the token ever existed").
  if invite.id is null
     or invite.batch_deleted_at is not null
     or invite.revoked_at is not null
     or (invite.expires_at is not null and invite.expires_at <= now())
     or (invite.max_uses is not null and invite.use_count >= invite.max_uses)
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return invite.batch_name;
end;
$fn$;

comment on function public.validate_invite(text, text) is
  'Deliberately minimal unauthenticated-capable read for the invite landing page (security.md §5.4, §9): batch name only, after the token validates.';

-- ---------------------------------------------------------------------------
-- redeem_invite: atomic membership creation (security.md §5.2, §9, §10).
-- Authenticated only — joining requires a real identity to attach the
-- membership to. Locks the invite row before checking/incrementing
-- use_count (database.md §3.4's documented concurrency requirement).
-- ---------------------------------------------------------------------------

create function public.redeem_invite(p_token_hash text, p_ip text default null)
returns table (batch_id uuid, batch_name text, status public.membership_status)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  invite record;
  existing record;
  new_status public.membership_status;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform public.check_invite_rate_limit(p_ip, caller);

  select bi.id, bi.batch_id, bi.revoked_at, bi.expires_at, bi.max_uses,
         bi.use_count, bi.created_by,
         b.name as batch_name, b.join_policy as batch_join_policy,
         b.deleted_at as batch_deleted_at
    into invite
    from public.batch_invites bi
    join public.batches b on b.id = bi.batch_id
   where bi.token_hash = p_token_hash
     for update of bi;

  if invite.id is null
     or invite.batch_deleted_at is not null
     or invite.revoked_at is not null
     or (invite.expires_at is not null and invite.expires_at <= now())
     or (invite.max_uses is not null and invite.use_count >= invite.max_uses)
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select bm.id, bm.status into existing
    from public.batch_members bm
   where bm.batch_id = invite.batch_id
     and bm.profile_id = caller
     for update;

  if existing.id is not null then
    -- A removed (or previously departed) member redeeming a fresh link does
    -- NOT silently rejoin (security.md §9.1) — same generic failure.
    if existing.status in ('removed', 'left') then
      raise exception 'not authorized' using errcode = '42501';
    end if;

    -- Already active or pending: idempotent no-op, no use_count
    -- double-charge on a retried call (testing.md §9).
    return query select invite.batch_id, invite.batch_name, existing.status;
    return;
  end if;

  new_status := case invite.batch_join_policy
                  when 'invite_only_auto_approve' then 'active'::public.membership_status
                  else 'pending'::public.membership_status
                end;

  insert into public.batch_members (
    batch_id, profile_id, role, status, invite_id, invited_by, joined_at
  )
  values (
    invite.batch_id, caller, 'member', new_status, invite.id, invite.created_by,
    case when new_status = 'active' then now() else null end
  );

  update public.batch_invites bi
     set use_count = bi.use_count + 1
   where bi.id = invite.id;

  return query select invite.batch_id, invite.batch_name, new_status;
end;
$fn$;

comment on function public.redeem_invite(text, text) is
  'Atomic invite redemption / membership creation (security.md §5.2, §9, §10). role is always hard-coded ''member'' — an invite can never confer a privileged role. A removed/departed member does not silently rejoin.';

-- ---------------------------------------------------------------------------
-- create_invite: admin+ only (security.md §4, §9, §20 — audited).
-- ---------------------------------------------------------------------------

create function public.create_invite(
  p_batch_id uuid,
  p_token_hash text,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns table (
  id uuid, batch_id uuid, max_uses integer, use_count integer,
  expires_at timestamptz, revoked_at timestamptz, created_by uuid,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  created public.batch_invites;
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

  if p_token_hash is null or char_length(p_token_hash) < 32 then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.batch_invites (batch_id, token_hash, max_uses, expires_at, created_by)
  values (p_batch_id, p_token_hash, p_max_uses, p_expires_at, caller)
  returning * into created;

  insert into public.audit_logs (
    batch_id, actor_profile_id, actor_role, action, target_kind, target_id
  )
  values (p_batch_id, caller, caller_role, 'invite_created', 'invite', created.id);

  return query
    select created.id, created.batch_id, created.max_uses, created.use_count,
           created.expires_at, created.revoked_at, created.created_by,
           created.created_at, created.updated_at;
end;
$fn$;

comment on function public.create_invite(uuid, text, integer, timestamptz) is
  'Admin+ invite creation, audited (security.md §4, §9, §20). Returns no token_hash — the raw token never reaches SQL at all; the application already holds it from generating the hash passed in.';

-- ---------------------------------------------------------------------------
-- revoke_invite: admin+ of the invite's own batch, idempotent, audited.
-- ---------------------------------------------------------------------------

create function public.revoke_invite(p_invite_id uuid)
returns table (
  id uuid, batch_id uuid, max_uses integer, use_count integer,
  expires_at timestamptz, revoked_at timestamptz, created_by uuid,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  target public.batch_invites;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select bi.* into target
    from public.batch_invites bi
   where bi.id = p_invite_id
     for update of bi;
  if target.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(target.batch_id);
  if caller_role is null or caller_role < 'admin'::public.batch_role then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if target.revoked_at is null then
    update public.batch_invites bi
       set revoked_at = now(), revoked_by = caller
     where bi.id = p_invite_id
     returning * into target;

    insert into public.audit_logs (
      batch_id, actor_profile_id, actor_role, action, target_kind, target_id
    )
    values (target.batch_id, caller, caller_role, 'invite_revoked', 'invite', target.id);
  end if;
  -- Already revoked: idempotent no-op, no duplicate audit row.

  return query
    select target.id, target.batch_id, target.max_uses, target.use_count,
           target.expires_at, target.revoked_at, target.created_by,
           target.created_at, target.updated_at;
end;
$fn$;

comment on function public.revoke_invite(uuid) is
  'Admin+ invite revocation, idempotent and audited (security.md §4, §9, §20).';

-- ---------------------------------------------------------------------------
-- Minimum EXECUTE grants (security.md §5.2.2). validate_invite is the one
-- deliberate exception granted to anon as well as authenticated; every
-- other function here is authenticated-only, and the rate-limit helper is
-- granted to no client role at all.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  fn text;
begin
  foreach fn in array array[
    'public.check_invite_rate_limit(text, uuid)',
    'public.validate_invite(text, text)',
    'public.redeem_invite(text, text)',
    'public.create_invite(uuid, text, integer, timestamptz)',
    'public.revoke_invite(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public', fn);
    foreach r in array array['anon', 'authenticated', 'service_role']
    loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on function %s from %I', fn, r);
      end if;
    end loop;
  end loop;

  execute 'grant execute on function public.validate_invite(text, text) to anon, authenticated';
  execute 'grant execute on function public.redeem_invite(text, text) to authenticated';
  execute 'grant execute on function public.create_invite(uuid, text, integer, timestamptz) to authenticated';
  execute 'grant execute on function public.revoke_invite(uuid) to authenticated';
  -- check_invite_rate_limit: no grant to any client role, deliberately.
end
$$;
