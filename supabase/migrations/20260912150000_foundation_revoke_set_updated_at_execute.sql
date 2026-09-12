-- Phase 0 — Foundation (forward correction).
--
-- `20260912120000_foundation_set_updated_at.sql` states that client roles need
-- no EXECUTE on the housekeeping trigger function, and revokes it `from public`.
-- On hosted Supabase that is not sufficient: `ALTER DEFAULT PRIVILEGES` in the
-- `public` schema grants `anon`, `authenticated` and `service_role` EXECUTE on
-- every newly created function as an **explicit per-role grant**, which a
-- `PUBLIC` revoke does not touch. Verified on the linked project: the live ACL
-- carried `anon=X | authenticated=X | service_role=X` (security.md §32, B2
-- finding (ii)).
--
-- This is a forward migration rather than an edit to the original, because the
-- original is already applied remotely and remote migration history is not
-- rewritten.
--
-- Trigger behaviour is deliberately unaffected. PostgreSQL checks EXECUTE on a
-- trigger function when the trigger is CREATED, not when it fires, so a client
-- role updating a row still has `updated_at` maintained without holding
-- EXECUTE itself. Revoking therefore removes the direct-call surface without
-- touching the housekeeping the schema depends on.

do $$
declare
  r text;
begin
  -- PUBLIC first: the default grant every new function starts with.
  execute 'revoke all on function public.set_updated_at() from public';

  -- Then the named client roles, which is the only form that removes the
  -- grants ALTER DEFAULT PRIVILEGES created. Guarded so the migration is also
  -- valid on a database where a given Supabase role does not exist.
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format(
        'revoke all on function public.set_updated_at() from %I', r
      );
    end if;
  end loop;
end
$$;
