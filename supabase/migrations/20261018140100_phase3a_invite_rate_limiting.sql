-- Phase 3A — Invitations & Join.
--
-- invite_redemption_attempts: bookkeeping for security.md §17's rate-limiting
-- requirement ("Invite redemption | Token brute force, batch probing | IP
-- and account"). Not a `database.md` MVP table — rate limiting is a
-- security.md requirement whose *mechanism* no document fixes (same
-- implementation latitude rules.md §1.3 grants RPC names/signatures: the
-- source documents specify the invariant, not the SQL shape). A small,
-- append-only, bounded table alongside the privileged redemption RPCs is the
-- narrowest way to satisfy it without a new external dependency (no Redis/
-- Upstash — not on the locked stack, rules.md §2).
--
-- Zero client-role grants at all, matching audit_logs' posture (database.md
-- §3.10): this table is written and read only from inside
-- validate_invite/redeem_invite, which run as the BYPASSRLS-holding owner
-- (security.md §32 B2) and need no grant to do so.

create table public.invite_redemption_attempts (
  id bigint generated always as identity primary key,
  ip text,
  profile_id uuid references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

comment on table public.invite_redemption_attempts is
  'Append-only bookkeeping for invite-redemption rate limiting, keyed by IP and/or account (security.md §17). No client role holds any grant on this table. Rows older than the rate-limit window are pruned inline by the functions that write here — there is no separate sweep for this bounded, low-volume table.';

alter table public.invite_redemption_attempts enable row level security;
alter table public.invite_redemption_attempts force row level security;

create index invite_redemption_attempts_ip_idx
  on public.invite_redemption_attempts (ip, attempted_at)
  where ip is not null;
create index invite_redemption_attempts_profile_idx
  on public.invite_redemption_attempts (profile_id, attempted_at)
  where profile_id is not null;

do $$
declare
  r text;
begin
  execute 'revoke all on table public.invite_redemption_attempts from public';
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public.invite_redemption_attempts from %I', r);
    end if;
  end loop;
end
$$;
-- No grant is added back to any client role.
