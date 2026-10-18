-- Phase 4A — Photo Upload Pipeline.
--
-- memories (database.md §3.5) and media_assets (database.md §3.6), their RLS
-- (enabled+forced in this same migration, security.md §5.1), the two
-- privileged RPCs (preallocate_media, finalize_memory, plus the narrow
-- purge_rejected_media cleanup helper), and the batch-media Storage policies
-- (security.md §6.2, §7.1).
--
-- Prerequisite decisions, all resolved before this migration was written
-- (CLAUDE.md rule 5 — source documents updated first):
--   B1 (EXIF/GPS)        -> server-side strip at finalize, JPEG only, no
--                           retained unstripped copy (security.md §27).
--   Q4 (derivatives)      -> (a) Supabase Storage image transformations
--                           (database.md Q4) — no schema change here.
--   R1 (signed-URL TTL)   -> 15 minutes (security.md R1).
--   R2 (delivery design)  -> skip the Next.js image optimizer; no
--                           application media route (security.md R2).
--
-- Scope is deliberately narrow, matching phases.md Phase 4A exactly:
-- ONE photo per memory (position is always 0 — no multi-asset upload flow
-- yet), no video, no edit, no delete, no blur placeholder generation (that
-- is a gallery concern, deferred to Phase 5A along with the real gallery —
-- the "minimal verification list" this phase ships does not need one).
-- `memories` carries NO direct client grant at all in this phase — a memory
-- is created only by `finalize_memory`; author edit is explicitly Phase 4B
-- scope (security.md §5.4 "own-memory text" ships then, not now).

-- ---------------------------------------------------------------------------
-- Enum types.
-- ---------------------------------------------------------------------------

create type public.media_kind as enum ('image', 'video');
create type public.media_status as enum ('pending', 'ready', 'rejected');

comment on type public.media_kind is
  'Provisional at preallocation (client-declared), reconciled against the Storage-reported type at finalize (database.md §3.6). Phase 4A only ever creates ''image'' rows — ''video'' exists now because the enum is not phase-scoped, but no Phase 4A code path produces it (Phase 4B).';

-- ---------------------------------------------------------------------------
-- memories (database.md §3.5). The central content table.
-- ---------------------------------------------------------------------------

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  caption text check (char_length(caption) <= 2000),
  event_name text check (char_length(event_name) <= 200),
  occurred_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,

  constraint memories_unique_id_batch unique (id, batch_id)
);

comment on table public.memories is
  'A dated, captioned entry in the archive (database.md §3.5). Created only by finalize_memory — no client role holds any direct INSERT/UPDATE/DELETE grant on this table in Phase 4A. Author edit (caption/event_name/occurred_on) and author/mod delete are Phase 4B scope.';
comment on column public.memories.occurred_on is
  'NOT NULL sort key: the stated event date when given, the upload date otherwise (database.md §3.5) — never a nullable column cast at index time.';

alter table public.memories enable row level security;
alter table public.memories force row level security;

create trigger set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

-- Indexes (database.md §3.5 "Indexes").
create index memories_gallery_idx
  on public.memories (batch_id, occurred_on desc, id desc)
  where deleted_at is null;
create index memories_batch_author_idx
  on public.memories (batch_id, created_by)
  where deleted_at is null;
create index memories_deleted_at_idx
  on public.memories (deleted_at)
  where deleted_at is not null;
create index memories_created_by_idx on public.memories (created_by);
create index memories_deleted_by_idx
  on public.memories (deleted_by)
  where deleted_by is not null;

-- ---------------------------------------------------------------------------
-- media_assets (database.md §3.6). The upload ledger; `id` is the Storage
-- path key.
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  memory_id uuid,
  kind public.media_kind not null,
  status public.media_status not null default 'pending',
  storage_bucket text not null,
  storage_path text not null,
  "position" smallint not null default 0 check ("position" >= 0),
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  client_reported_duration_seconds integer check (
    client_reported_duration_seconds is null or client_reported_duration_seconds > 0
  ),
  blur_placeholder text,
  content_hash text,
  poster_media_asset_id uuid,
  original_filename text check (char_length(original_filename) <= 255),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint media_assets_unique_id_batch unique (id, batch_id),
  constraint media_assets_unique_storage_path unique (storage_path),
  -- A ready asset is always attached, measured, and typed (database.md §3.6).
  constraint media_assets_readiness check (
    status <> 'ready'
    or (memory_id is not null and byte_size is not null and mime_type is not null)
  ),
  -- A file declared as an image that stores as a video (or vice versa)
  -- cannot reach ready (database.md §3.6).
  constraint media_assets_kind_matches_mime check (
    status <> 'ready'
    or (kind = 'image' and mime_type like 'image/%')
    or (kind = 'video' and mime_type like 'video/%')
  )
);

comment on table public.media_assets is
  'Stored objects and their metadata; also the upload ledger (database.md §3.6). id is the Storage path key: storage_path is server-composed as {batch_id}/{id}.';
comment on column public.media_assets.mime_type is
  'NULL while pending (nothing observed yet); populated from Storage''s own object metadata at finalize — never the client''s declared type, which is a transient upload-request-time gate and is not persisted (database.md §3.6).';
comment on column public.media_assets.byte_size is
  'The actual stored size Storage reports at finalize — authoritative relative to the client''s declaration, never the declaration itself.';

alter table public.media_assets enable row level security;
alter table public.media_assets force row level security;

create trigger set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

-- A memory cannot own media from a different batch; pending rows (memory_id
-- IS NULL) are exempt via MATCH SIMPLE, which is exactly what the two-phase
-- upload needs (database.md §3.6, §14).
alter table public.media_assets
  add constraint media_assets_memory_fkey
  foreign key (memory_id, batch_id) references public.memories (id, batch_id)
  on delete cascade;

-- Poster-frame self-reference (database.md §3.6, §14) — not populated until
-- Phase 4B (video), included now because the FK target (this same table)
-- already exists; retrofitting a self-FK later is more awkward than
-- declaring it unused.
alter table public.media_assets
  add constraint media_assets_poster_fkey
  foreign key (poster_media_asset_id, batch_id) references public.media_assets (id, batch_id)
  on delete set null (poster_media_asset_id);

-- Deferrable: finalize can briefly hold two assets at the same position
-- within one transaction without tripping the constraint mid-statement
-- (database.md §3.6) — not exercised by Phase 4A's single-asset flow, but
-- declared now to match the documented schema exactly.
alter table public.media_assets
  add constraint media_assets_unique_memory_position
  unique (memory_id, "position") deferrable initially immediate;

-- Indexes (database.md §3.6 "Indexes").
create index media_assets_batch_id_idx on public.media_assets (batch_id);
create index media_assets_sweep_idx
  on public.media_assets (created_at)
  where status <> 'ready';
create index media_assets_deleted_at_idx
  on public.media_assets (deleted_at)
  where deleted_at is not null;
create index media_assets_created_by_idx on public.media_assets (created_by);
create index media_assets_poster_idx
  on public.media_assets (poster_media_asset_id)
  where poster_media_asset_id is not null;

-- ---------------------------------------------------------------------------
-- Privileges. Both tables: zero INSERT/UPDATE/DELETE grant to any client
-- role (RPC-only — security.md §5.2, §5.4). Reads are policy-governed SELECT.
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  t text;
begin
  foreach t in array array['public.memories', 'public.media_assets']
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

grant select on public.memories to authenticated;
grant select on public.media_assets to authenticated;

-- ---------------------------------------------------------------------------
-- Policies.
-- ---------------------------------------------------------------------------

create policy memories_select_member on public.memories
  for select
  to authenticated
  using (deleted_at is null and public.my_batch_role(batch_id) is not null);

-- `ready` media: active member of the batch, batch/media/memory all live
-- (security.md §7.1). `pending`: own row only — the uploader needs to read
-- it back during the upload/finalize flow. `rejected`: no policy admits it
-- at all — never generally readable (security.md §7.1).
create policy media_assets_select_ready on public.media_assets
  for select
  to authenticated
  using (
    status = 'ready'
    and deleted_at is null
    and exists (
      select 1
        from public.memories m
       where m.id = media_assets.memory_id
         and m.batch_id = media_assets.batch_id
         and m.deleted_at is null
    )
    and public.my_batch_role(batch_id) is not null
  );

create policy media_assets_select_own_pending on public.media_assets
  for select
  to authenticated
  using (status = 'pending' and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- preallocate_media (security.md §5.2, architecture §8 step 2). Verifies
-- membership, validates the declared type/size against the Phase 4A policy
-- (image only; Phase 4B adds video), and inserts the pending row with the
-- server-composed path. Returns the full row — media_assets has no column
-- needing exclusion, so `returns public.media_assets` is safe here (unlike
-- Phase 3A's batch_invites.token_hash case).
-- ---------------------------------------------------------------------------

create function public.preallocate_media(
  p_batch_id uuid,
  p_declared_mime_type text,
  p_declared_size bigint,
  p_original_filename text default null
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
  -- 15 MiB — this phase's chosen image cap (security.md §16: "exact
  -- figures are a product/ops decision"; recorded here, not invented
  -- silently, and revisitable without a schema change).
  max_image_bytes constant bigint := 15 * 1024 * 1024;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  caller_role := public.my_batch_role(p_batch_id);
  if caller_role is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Phase 4A: image only (security.md §15's image allowlist; no SVG).
  -- Video is Phase 4B. The client's declared type is a transient gate —
  -- never persisted (database.md §3.6) — bounding what the signed upload
  -- target is issued for; finalize re-checks the Storage-observed type
  -- regardless.
  if p_declared_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_declared_size is null or p_declared_size <= 0 or p_declared_size > max_image_bytes then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  new_id := gen_random_uuid();

  insert into public.media_assets (
    id, batch_id, kind, status, storage_bucket, storage_path, "position",
    original_filename, created_by
  )
  values (
    new_id, p_batch_id, 'image', 'pending', 'batch-media',
    p_batch_id::text || '/' || new_id::text, 0,
    p_original_filename, caller
  )
  returning * into created;

  return created;
end;
$fn$;

comment on function public.preallocate_media(uuid, text, bigint, text) is
  'Membership-checked preallocation (architecture §8 step 2; security.md §5.2). Phase 4A: image only. Path is server-composed; the client never chooses it.';

-- ---------------------------------------------------------------------------
-- finalize_memory (security.md §5.2, §14; architecture §8 step 4;
-- database.md §3.6). Idempotent per media asset id. Assumes the Node-side
-- Server Action has ALREADY performed the B1 EXIF-strip-and-reupload step
-- (SQL cannot touch Storage bytes) — this function validates and reads
-- Storage's own observed metadata for the object as it stands when called.
--
-- Reads `storage.objects.metadata` directly rather than calling the Storage
-- API a second time: Supabase Storage already maintains this as ordinary
-- Postgres row metadata, and a SECURITY DEFINER function in this project
-- bypasses storage.objects' RLS the identical way it bypasses every other
-- table's (security.md §32 B2 — verified, not assumed).
-- ---------------------------------------------------------------------------

create function public.finalize_memory(
  p_media_asset_id uuid,
  p_caption text,
  p_event_name text,
  p_occurred_on date
)
returns public.memories
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  asset public.media_assets;
  existing_memory public.memories;
  object_metadata jsonb;
  observed_mime text;
  observed_size bigint;
  new_memory public.memories;
  max_image_bytes constant bigint := 15 * 1024 * 1024;
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
    -- A ready asset with no resolvable memory is an inconsistent state
    -- this function never produces; refuse rather than guess.
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- A previously rejected or already-removed row cannot be retried — a
  -- fresh preallocation is required (database.md §3.6: rejected rows are
  -- transient, not a retry target).
  if asset.status <> 'pending' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select o.metadata into object_metadata
    from storage.objects o
   where o.bucket_id = asset.storage_bucket
     and o.name = asset.storage_path;

  -- A Postgres statement that raises has NO lasting side effects at all —
  -- including its own prior writes within that same statement. So the two
  -- branches below, which must both PERSIST the rejected status AND signal
  -- failure, cannot `raise`; they `return null` instead. `null` is a
  -- legitimate, distinct outcome for a composite-returning function and is
  -- how the caller (the Server Action) distinguishes "rejected" (look up
  -- media_assets.status, which is really 'rejected') from the ordinary
  -- authorization failures above and below, which still correctly `raise`
  -- because they have no persisted side effect to protect.
  if object_metadata is null then
    -- No object at the issued path at all — nothing to reject-and-delete.
    update public.media_assets ma set status = 'rejected' where ma.id = asset.id;
    return null;
  end if;

  observed_mime := object_metadata ->> 'mimetype';
  observed_size := (object_metadata ->> 'size')::bigint;

  if observed_mime is null
     or observed_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
     or observed_size is null
     or observed_size <= 0
     or observed_size > max_image_bytes
  then
    update public.media_assets ma set status = 'rejected' where ma.id = asset.id;
    return null;
  end if;

  if p_occurred_on is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.memories (batch_id, created_by, caption, event_name, occurred_on)
  values (asset.batch_id, caller, p_caption, p_event_name, p_occurred_on)
  returning * into new_memory;

  update public.media_assets ma
     set status = 'ready',
         memory_id = new_memory.id,
         mime_type = observed_mime,
         byte_size = observed_size
   where ma.id = asset.id;

  return new_memory;
end;
$fn$;

comment on function public.finalize_memory(uuid, text, text, date) is
  'Idempotent finalize (architecture section 8 step 4, section 18.8; security.md section 14): re-verifies membership, enforces Storage-observed size/type against the allowlist, writes memory+media in one transaction. A rejection sets status=rejected and returns NULL (never raises for this case — a Postgres statement that raises has no lasting side effects, including its own prior writes, so persisting the rejected status requires returning normally instead). The Storage object itself is not deleted here (SQL cannot safely do that without orphaning backing bytes) — the calling Server Action does the object-first Storage API delete, then calls purge_rejected_media.';

-- ---------------------------------------------------------------------------
-- purge_rejected_media: the second half of the object-first rejection
-- cleanup (database.md §3.6, §24). Called by the Server Action only AFTER
-- it has confirmed the Storage object is deleted (or already absent) via
-- the Storage API — never before, and never by SQL deleting
-- storage.objects directly, which would desynchronize the backing bytes
-- from the metadata row.
-- ---------------------------------------------------------------------------

create function public.purge_rejected_media(p_media_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := auth.uid();
  deleted_id uuid;
begin
  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  delete from public.media_assets
   where id = p_media_asset_id
     and created_by = caller
     and status = 'rejected'
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$fn$;

comment on function public.purge_rejected_media(uuid) is
  'Hard-deletes the caller''s own already-rejected row, only after the Storage object is confirmed gone (database.md section 24''s object-first ordering).';

-- ---------------------------------------------------------------------------
-- Minimum EXECUTE grants (security.md §5.2.2).
-- ---------------------------------------------------------------------------

do $$
declare
  r text;
  fn text;
begin
  foreach fn in array array[
    'public.preallocate_media(uuid, text, bigint, text)',
    'public.finalize_memory(uuid, text, text, date)',
    'public.purge_rejected_media(uuid)'
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

-- ---------------------------------------------------------------------------
-- Storage policies for the batch-media bucket (security.md §6.2, §7.1).
-- Deliberately NO delete policy for any client role: "ordinary members
-- hold no Storage delete" — rejected-object removal runs with system
-- authority (the service-role client), a narrow addition to that allowlist
-- (security.md §12), not a client-role grant.
-- ---------------------------------------------------------------------------

-- Upload (and the EXIF-strip step's own overwrite-reupload) is scoped to a
-- single server-preallocated PENDING row the caller owns. A `ready` object
-- can never be targeted by this predicate again, so it cannot be
-- overwritten through the ordinary path (security.md §6.2).
create policy batch_media_insert_own_pending on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'batch-media'
    and exists (
      select 1
        from public.media_assets ma
       where ma.id::text = storage.filename(name)
         and ma.batch_id::text = (storage.foldername(name))[1]
         and ma.status = 'pending'
         and ma.created_by = auth.uid()
    )
  );

create policy batch_media_update_own_pending on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'batch-media'
    and exists (
      select 1
        from public.media_assets ma
       where ma.id::text = storage.filename(name)
         and ma.batch_id::text = (storage.foldername(name))[1]
         and ma.status = 'pending'
         and ma.created_by = auth.uid()
    )
  )
  with check (
    bucket_id = 'batch-media'
    and exists (
      select 1
        from public.media_assets ma
       where ma.id::text = storage.filename(name)
         and ma.batch_id::text = (storage.foldername(name))[1]
         and ma.status = 'pending'
         and ma.created_by = auth.uid()
    )
  );

create policy batch_media_select_ready on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'batch-media'
    and exists (
      select 1
        from public.media_assets ma
        join public.memories m
          on m.id = ma.memory_id and m.batch_id = ma.batch_id
       where ma.id::text = storage.filename(name)
         and ma.batch_id::text = (storage.foldername(name))[1]
         and ma.status = 'ready'
         and ma.deleted_at is null
         and m.deleted_at is null
         and public.my_batch_role(ma.batch_id) is not null
    )
  );

create policy batch_media_select_own_pending on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'batch-media'
    and exists (
      select 1
        from public.media_assets ma
       where ma.id::text = storage.filename(name)
         and ma.batch_id::text = (storage.foldername(name))[1]
         and ma.status = 'pending'
         and ma.created_by = auth.uid()
    )
  );
