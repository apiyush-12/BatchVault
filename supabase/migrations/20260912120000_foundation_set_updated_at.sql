-- Phase 0 — Foundation.
--
-- The shared `updated_at` housekeeping function (database.md §11).
--
-- This is the ONLY trigger function the schema will ever have. It makes no
-- decision, reads no other row and enforces no product rule — counters,
-- cascades, audit writes, notification fan-out and state transitions are all
-- business logic and live in explicit SQL functions where review can see them.
--
-- Every mutable table created from Phase 1 onwards attaches this BEFORE UPDATE.
-- No application table is created here.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared BEFORE UPDATE housekeeping trigger: maintains updated_at. The only trigger function in the schema (database.md §11).';

-- Nothing calls this directly. Trigger execution privilege is checked when the
-- trigger is created, not when it fires, so client roles need no EXECUTE.
revoke all on function public.set_updated_at() from public;
