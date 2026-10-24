import "server-only";

import { getMediaAssetsByIds, getMediaSignedUrl, getPrimaryMediaByMemoryIds } from "@/features/media/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { Memory, MemoryWithMedia } from "./types";

interface MemoryRow {
  id: string;
  batch_id: string;
  created_by: string | null;
  caption: string | null;
  event_name: string | null;
  occurred_on: string;
  created_at: string;
}

function mapRow(row: MemoryRow): Memory {
  return {
    id: row.id,
    batchId: row.batch_id,
    createdBy: row.created_by,
    caption: row.caption,
    eventName: row.event_name,
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
  };
}

interface GalleryCursor {
  occurredOn: string;
  id: string;
}

export interface GalleryPage {
  memories: MemoryWithMedia[];
  nextCursor: GalleryCursor | null;
}

async function attachMedia(memories: Memory[], callerId: string | null): Promise<MemoryWithMedia[]> {
  const primaryByMemoryId = await getPrimaryMediaByMemoryIds(memories.map((memory) => memory.id));
  const posterIds = Array.from(primaryByMemoryId.values())
    .map((media) => media.posterMediaAssetId)
    .filter((id): id is string => id !== null);
  const posterById = await getMediaAssetsByIds(posterIds);

  return Promise.all(
    memories.map(async (memory) => {
      const media = primaryByMemoryId.get(memory.id);
      if (media === undefined) {
        return { ...memory, mediaKind: null, mediaUrl: null, posterUrl: null, isOwnMemory: memory.createdBy === callerId };
      }

      const mediaUrl =
        media.kind === "image"
          ? await getMediaSignedUrl("batch-media", media.storagePath, { width: 480, height: 480 })
          : await getMediaSignedUrl("batch-media", media.storagePath);

      const poster = media.posterMediaAssetId !== null ? posterById.get(media.posterMediaAssetId) : undefined;
      const posterUrl =
        poster !== undefined
          ? await getMediaSignedUrl("batch-media", poster.storagePath, { width: 480, height: 480 })
          : null;

      return {
        ...memory,
        mediaKind: media.kind,
        mediaUrl,
        posterUrl,
        isOwnMemory: memory.createdBy === callerId,
      };
    }),
  );
}

/**
 * The real gallery (phases.md Phase 5A): keyset/cursor pagination over the
 * `(batch_id, occurred_on DESC, id DESC) WHERE deleted_at IS NULL` index
 * (database.md §3.5) — never offset/limit over the whole archive
 * (architecture §19; rules.md §2).
 */
export async function listGalleryPage(
  batchId: string,
  cursor: GalleryCursor | null = null,
  pageSize = 24,
): Promise<GalleryPage> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const callerId = userData.user?.id ?? null;

  let query = supabase
    .from("memories")
    .select("id, batch_id, created_by, caption, event_name, occurred_on, created_at")
    .eq("batch_id", batchId)
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  if (cursor !== null) {
    query = query.or(
      `occurred_on.lt.${cursor.occurredOn},and(occurred_on.eq.${cursor.occurredOn},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error !== null) {
    throw error;
  }

  const rows = (data ?? []).map(mapRow);
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last !== undefined ? { occurredOn: last.occurredOn, id: last.id } : null;

  return { memories: await attachMedia(page, callerId), nextCursor };
}

/** A single memory by id, for the edit form. RLS admits only what the caller may see. */
export async function getMemoryById(memoryId: string): Promise<Memory | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memories")
    .select("id, batch_id, created_by, caption, event_name, occurred_on, created_at")
    .eq("id", memoryId)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }
  if (data === null) {
    return null;
  }
  return mapRow(data as MemoryRow);
}

/**
 * Memory detail (phases.md Phase 5A): the memory plus its full media
 * (primary asset + its poster, if any — this MVP never shows more than one
 * displayable asset per memory). `null` when the caller cannot see it at
 * all — RLS-indistinguishable from "does not exist" (security.md §3).
 */
export async function getMemoryDetail(
  memoryId: string,
): Promise<MemoryWithMedia | null> {
  const memory = await getMemoryById(memoryId);
  if (memory === null) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const [withMedia] = await attachMedia([memory], userData.user?.id ?? null);
  return withMedia ?? null;
}

/**
 * Timeline grouping (phases.md Phase 5B): every visible memory for the
 * batch, grouped by the calendar year of `occurred_on` — a simple,
 * date-anchored browsing mode distinct from the paginated gallery. Not
 * paginated (an alumni batch's total memory count is small enough for one
 * pass; revisit if that stops being true).
 */
export interface TimelineGroup {
  year: number;
  memories: MemoryWithMedia[];
}

export async function listTimeline(batchId: string): Promise<TimelineGroup[]> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const callerId = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from("memories")
    .select("id, batch_id, created_by, caption, event_name, occurred_on, created_at")
    .eq("batch_id", batchId)
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);

  if (error !== null) {
    throw error;
  }

  const memories = await attachMedia((data ?? []).map(mapRow), callerId);

  const groups = new Map<number, MemoryWithMedia[]>();
  for (const memory of memories) {
    const year = new Date(memory.occurredOn).getFullYear();
    const bucket = groups.get(year) ?? [];
    bucket.push(memory);
    groups.set(year, bucket);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, yearMemories]) => ({ year, memories: yearMemories }));
}
