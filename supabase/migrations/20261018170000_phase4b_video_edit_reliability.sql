-- Phase 4B — Video Constraints, Edit/Delete & Media Reliability.
--
-- Prerequisite decisions, resolved in their source documents before this
-- migration was written (CLAUDE.md rule 5):
--   PRD #7 (edit/delete rights)  -> RESOLVED 2026-10-24 (docs/PRD.md
--     "Unresolved" item 7): a Member may EDIT their own memory's
--     caption/event_name/occurred_on, at any time, with no time limit.
--     A Member may NOT self-delete their own memory. Removal remains
--     mod+ only, via the moderator-removal path that arrives in Phase 8A
--     — nothing in this migration grants any DELETE or deleted_at-setting
--     capability to any client role.
--   R6 (HEIC)                   -> RESOLVED 2026-10-24 (security.md R6):
--     stays excluded from the server-side allowlist; handled as
--     client-side advisory UX only (features/media, no schema change).
--
-- Scope, matching phases.md Phase 4B exactly:
--   - video/mp4 upload (own size cap, distinct from the image cap), with
--     an optional client-captured poster-frame companion image.
--   - A soft, client-side-only duration cap: `client_reported_duration_seconds`
--     is now accepted and stored at preallocate time, but is NEVER an
--     enforcement input anywhere server-side (ADR-08a) — advisory only.
--   - Author edit of caption/event_name/occurred_on via POLICY-CHECKED
--     DIRECT DML (not an RPC) — the column set is identical to Phase 4A's
--     already-documented writable set for `memories`.
--   - Two new service-role-only RPCs backing the Vercel Cron sweep
--     (architecture §13): `list_sweepable_media` (read) and
--     `purge_swept_media` (object-first-ordered row purge, called only
--     after the cron route's own Storage API delete has confirmed the
--     object gone or already absent).
--
-- No new table. No new enum. No author self-delete. No moderator removal
-- (Phase 8A). The existing `media_assets_sweep_idx (created_at) WHERE
-- status <> 'ready'` and `memories_deleted_at_idx` from the Phase 4A
-- migration already serve this phase's sweep — no new index is needed
-- (phases.md Phase 4B: "...if not already present").

-- ---------------------------------------------------------------------------
-- preallocate_media: replaced to support video alongside image. The
-- original 4-argument signature is dropped and re-created with a trailing
-- optional parameter (CREATE OR REPLACE cannot add parameters to an
-- existing signature; dropping and re-creating is required and safe here
-- since every caller passes arguments by name, not position).
-- ---------------------------------------------------------------------------

drop function if exists public.preallocate_media(uuid, text, bigint, text);

create function public.preallocate_media(
  p_batch_id uuid,
  p_declared_mime_type text,
  p_declared_size bigint,
  p_original_filename text default null,
  p_client_reported_duration_seconds integer default null
)
returns public.media_assets
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  caller_role public.batch_role;
  new_id uuid;
  created public.media_assets;
  resolved_kind public.media_kind;
  size_cap bigint;
  -- 15 MiB image cap, unchanged from Phase 4A. 100 MiB video cap is this
  -- phase's own chosen figure (security.md §16: "exact figures are a
  -- product/ops decision"), not fixed by any doc, and revisitable without
  -- a schema change — the same latitude the 15 MiB image cap was given.
  max_image_bytes constant bigint := 15 * 1024 * 1024;
  max_video_bytes constant bigint := 100 * 1024 * 1024;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- The client's declared type/kind is a transient gate — never persisted
  -- as the authoritative fact (database.md §3.6); finalize re-checks the
  -- Storage-observed type regardless. HEIC/HEIF is never in this
  -- allowlist (security.md R6, resolved as client-side UX guidance only —
  -- no server-side change).
  if p_declared_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') then
    resolved_kind := 'image';
    size_cap := max_image_bytes;
  elsif p_declared_mime_type = 'video/mp4' then
    resolved_kind := 'video';
    size_cap := max_video_bytes;
  else
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_declared_size is null or p_declared_size <= 0 or p_declared_size > size_cap then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Advisory only (ADR-08a) — a sanity bound on the stored value itself,
  -- never treated as proof of the real duration.
  if p_client_reported_duration_seconds is not null and p_client_reported_duration_seconds <= 0 then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  new_id := gen_random_uuid();

  insert into public.media_assets (
    id, batch_id, kind, status, storage_bucket, storage_path, "position",
    original_filename, created_by, client_reported_duration_seconds
  )
  values (
    new_id, p_batch_id, resolved_kind, 'pending', 'batch-media',
    p_batch_id::text || '/' || new_id::text, 0,
    p_original_filename, caller, p_client_reported_duration_seconds
  )
  returning * into created;

  return created;
end;
$fn$;

comment on function public.preallocate_media(uuid, text, bigint, text, integer) is
  'Membership-checked preallocation (architecture §8 step 2; security.md §5.2). Phase 4B: image or video/mp4, each with its own size cap. client_reported_duration_seconds is stored as-declared and is never an enforcement input (ADR-08a). Path is server-composed; the client never chooses it.';

-- ---------------------------------------------------------------------------
-- finalize_memory: replaced to (a) validate against the per-KIND allowlist
-- and cap (derived from the asset's own stored `kind`, set at preallocate
-- time — never re-read from client input), and (b) optionally link a
-- client-captured poster-frame companion image.
--
-- Poster handling is deliberately lenient: a missing or invalid poster
-- never fails the primary upload. "Client-captured poster frame... neutral
-- on-brand placeholder when capture fails" (phases.md Phase 4B) means a
-- failed poster capture is an ordinary, expected outcome, not an error
-- condition for the memory itself — the frontend already falls back to a
-- placeholder when no poster is linked. An invalid/unlinkable poster asset
-- is simply left unlinked; it becomes an orphaned `pending` row that the
-- cron sweep (below) reaps on its own schedule like any other abandoned
-- upload — never a silent leak, never a blocker for the video.
-- ---------------------------------------------------------------------------

drop function if exists public.finalize_memory(uuid, text, text, date);

create function public.finalize_memory(
  p_media_asset_id uuid,
  p_caption text,
  p_event_name text,
  p_occurred_on date,
  p_poster_media_asset_id uuid default null
)
returns public.memories
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  asset public.media_assets;
  poster public.media_assets;
  existing_memory public.memories;
  object_metadata jsonb;
  observed_mime text;
  observed_size bigint;
  poster_metadata jsonb;
  poster_observed_mime text;
  poster_observed_size bigint;
  new_memory public.memories;
  size_cap bigint;
  allowed_mimes text[];
  max_image_bytes constant bigint := 15 * 1024 * 1024;
  max_video_bytes constant bigint := 100 * 1024 * 1024;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select ma.* into asset
    from public.media_assets ma
   where ma.id = p_media_asset_id
     and ma.created_by = caller
     for update of ma;

  if asset.id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Membership is re-verified at finalize, not assumed to still hold from
  -- preallocation time (architecture §8 step 4).
  if public.my_batch_role(asset.batch_id) is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Idempotent retry: already finalized — return the existing memory,
  -- never create a second one (architecture §18.8).
  if asset.status = 'ready' then
    select m.* into existing_memory
      from public.memories m
     where m.id = asset.memory_id and m.batch_id = asset.batch_id;
    if existing_memory.id is not null then
      return existing_memory;
    end if;
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- A previously rejected or already-removed row cannot be retried — a
  -- fresh preallocation is required (database.md §3.6).
  if asset.status <> 'pending' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Allowlist/cap are derived from the asset's OWN stored kind (set at
  -- preallocate time from the client's declared type), never re-trusted
  -- from any new client input at finalize.
  if asset.kind = 'video' then
    allowed_mimes := array['video/mp4'];
    size_cap := max_video_bytes;
  else
    allowed_mimes := array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    size_cap := max_image_bytes;
  end if;

  select o.metadata into object_metadata
    from storage.objects o
   where o.bucket_id = asset.storage_bucket
     and o.name = asset.storage_path;

  -- A Postgres statement that raises has NO lasting side effects at all —
  -- including its own prior writes within that same statement (the real
  -- defect Phase 4A's own session found and fixed). The two branches below
  -- PERSIST the rejected status and therefore `return null` instead of
  -- raising; `null` is a legitimate, distinct outcome the Server Action
  -- distinguishes from an ordinary (still-raising) authorization failure.
  if object_metadata is null then
    update public.media_assets ma set status = 'rejected' where ma.id = asset.id;
    return null;
  end if;

  observed_mime := object_metadata ->> 'mimetype';
  observed_size := (object_metadata ->> 'size')::bigint;

  if observed_mime is null
     or not (observed_mime = any (allowed_mimes))
     or observed_size is null
     or observed_size <= 0
     or observed_size > size_cap
  then
    update public.media_assets ma set status = 'rejected' where ma.id = asset.id;
    return null;
  end if;

  if p_occurred_on is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Resolve the poster candidate, if one was supplied, BEFORE writing the
  -- memory — all validation is read-only up to this point, so a poster
  -- that turns out unusable changes nothing about the primary write below.
  if p_poster_media_asset_id is not null then
    select ma.* into poster
      from public.media_assets ma
     where ma.id = p_poster_media_asset_id
       and ma.batch_id = asset.batch_id
       and ma.created_by = caller
       and ma.status = 'pending'
       and ma.kind = 'image'
       for update of ma;

    if poster.id is not null then
      select o.metadata into poster_metadata
        from storage.objects o
       where o.bucket_id = poster.storage_bucket
         and o.name = poster.storage_path;

      if poster_metadata is not null then
        poster_observed_mime := poster_metadata ->> 'mimetype';
        poster_observed_size := (poster_metadata ->> 'size')::bigint;

        if poster_observed_mime is null
           or poster_observed_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
           or poster_observed_size is null
           or poster_observed_size <= 0
           or poster_observed_size > max_image_bytes
        then
          -- Invalid poster bytes: reject the poster row only, leave the
          -- primary upload entirely unaffected (see header comment).
          update public.media_assets ma set status = 'rejected' where ma.id = poster.id;
          poster.id := null;
        end if;
      else
        -- No object at the poster's path: nothing to reject-and-delete,
        -- just leave the primary upload unaffected and forget this poster.
        poster.id := null;
      end if;
    end if;
  end if;

  insert into public.memories (batch_id, created_by, caption, event_name, occurred_on)
  values (asset.batch_id, caller, p_caption, p_event_name, p_occurred_on)
  returning * into new_memory;

  update public.media_assets ma
     set status = 'ready',
         memory_id = new_memory.id,
         mime_type = observed_mime,
         byte_size = observed_size,
         poster_media_asset_id = poster.id
   where ma.id = asset.id;

  if poster.id is not null then
    update public.media_assets ma
       set status = 'ready',
           memory_id = new_memory.id,
           "position" = 1,
           mime_type = poster_observed_mime,
           byte_size = poster_observed_size
     where ma.id = poster.id;
  end if;

  return new_memory;
end;
$fn$;

comment on function public.finalize_memory(uuid, text, text, date, uuid) is
  'Idempotent finalize (architecture §8 step 4, §18.8; security.md §14), extended in Phase 4B for video: the allowlist/cap are derived from the asset''s own stored kind. An optional client-captured poster-frame companion image is validated and linked (media_assets.poster_media_asset_id) when usable; an unusable/missing poster never fails the primary upload — it is simply left unlinked for the cron sweep to reap (phases.md Phase 4B). Rejection still sets status=rejected and returns NULL rather than raising, for the same statement-rollback-on-raise reason Phase 4A documented.';

-- ---------------------------------------------------------------------------
-- Author edit (phases.md Phase 4B; PRD #7, resolved above): policy-checked
-- DIRECT DML, not an RPC — the column set is identical to the one
-- security.md §5.4.1 already documents for this table (caption,
-- event_name, occurred_on only). batch_id/created_by/timestamps/
-- deleted_at/deleted_by remain impossible to set because no UPDATE grant
-- on those columns exists at all — forging them fails at the column
-- privilege check, before the row policy is even evaluated.
-- ---------------------------------------------------------------------------

grant update (caption, event_name, occurred_on) on public.memories to authenticated;

create policy memories_update_own on public.memories
  for update
  to authenticated
  using (
    deleted_at is null
    and created_by = auth.uid()
    and public.my_batch_role(batch_id) is not null
  )
  with check (
    deleted_at is null
    and created_by = auth.uid()
    and public.my_batch_role(batch_id) is not null
  );

comment on policy memories_update_own on public.memories is
  'PRD #7 (resolved 2026-10-24): a Member may edit (never delete) their own memory, with no time limit, for as long as they remain an active member and the memory is not removed. Paired with the column-level GRANT above, which is the only thing actually restricting WHICH columns this policy''s USING clause ever gets to evaluate an UPDATE against.';

-- ---------------------------------------------------------------------------
-- Cron-sweep RPCs (architecture §13; security.md §12 call site 2 — "a
-- bounded cron/cleanup job acting across batches with no user present").
-- Both are SECURITY DEFINER (so they run as the table owner, bypassing RLS
-- the same verified way every other privileged function in this project
-- does — security.md §32 B2) and grant EXECUTE to `service_role` ONLY —
-- never `authenticated`, never `anon`. The Storage byte deletion itself
-- cannot happen in SQL (a raw DELETE on storage.objects does not trigger
-- physical deletion), so the division of labor is: this RPC lists
-- candidates, the cron Route Handler deletes the Storage objects via the
-- Storage API using the service-role client, and ONLY THEN calls the
-- second RPC to purge the now-byte-confirmed-gone rows — the same
-- object-first ordering `purge_rejected_media` already established
-- (database.md §24).
-- ---------------------------------------------------------------------------

create function public.list_sweepable_media(p_grace_seconds integer default 86400)
returns table (
  id uuid,
  storage_bucket text,
  storage_path text,
  status public.media_status
)
language sql
security definer
set search_path = ''
stable
as $fn$
  select ma.id, ma.storage_bucket, ma.storage_path, ma.status
    from public.media_assets ma
   where ma.status = 'rejected'
      or (ma.status = 'pending' and ma.created_at < now() - make_interval(secs => p_grace_seconds));
$fn$;

comment on function public.list_sweepable_media(integer) is
  'Lists orphaned pending uploads older than the grace window, plus every rejected row regardless of age (database.md §10 index #6; architecture §13). Read-only; deletes nothing. service_role only.';

do $$
declare
  r text;
begin
  execute 'revoke all on function public.list_sweepable_media(integer) from public';
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function public.list_sweepable_media(integer) from %I', r);
    end if;
  end loop;
end
$$;
grant execute on function public.list_sweepable_media(integer) to service_role;

create function public.purge_swept_media(p_media_asset_ids uuid[])
returns setof uuid
language sql
security definer
set search_path = ''
as $fn$
  delete from public.media_assets
   where id = any (p_media_asset_ids)
     and (
       status = 'rejected'
       or status = 'pending'
     )
  returning id;
$fn$;

comment on function public.purge_swept_media(uuid[]) is
  'Hard-deletes the given rows, called ONLY after the cron route''s own Storage API delete has confirmed every corresponding object gone or already absent (database.md §24 object-first ordering). Idempotent by construction: an id already purged, or never matching the re-checked status predicate (e.g. a pending upload that finished finalizing between list and purge), is silently skipped rather than erroring — a retried sweep is always safe. service_role only.';

do $$
declare
  r text;
begin
  execute 'revoke all on function public.purge_swept_media(uuid[]) from public';
  foreach r in array array['anon', 'authenticated', 'service_role']
  loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function public.purge_swept_media(uuid[]) from %I', r);
    end if;
  end loop;
end
$$;
grant execute on function public.purge_swept_media(uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- EXECUTE grants for the two replaced functions (security.md §5.2.2) —
-- re-asserted on the new signatures exactly as Phase 4A asserted them on
-- the old ones.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  fn text;
begin
  foreach fn in array array[
    'public.preallocate_media(uuid, text, bigint, text, integer)',
    'public.finalize_memory(uuid, text, text, date, uuid)'
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
