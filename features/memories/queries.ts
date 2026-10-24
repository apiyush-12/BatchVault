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

/**
 * The "minimal verification list" (architecture §8 step 5; phases.md
 * Phase 4A) — deliberately unpolished: no pagination, no grouping. The
 * real gallery is Phase 5A. Ordered newest-event-first, mirroring the
 * gallery's eventual `occurred_on DESC, id DESC` ordering (database.md
 * §3.5) even though this list is not yet paginated by it.
 *
 * Phase 4B: also resolves each memory's media KIND, a video's poster
 * image (if one was linked), and whether the caller is the memory's own
 * author (drives the Edit link only — PRD #7, resolved 2026-10-24).
 */
export async function listRecentMemories(batchId: string): Promise<MemoryWithMedia[]> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const callerId = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from("memories")
    .select("id, batch_id, created_by, caption, event_name, occurred_on, created_at")
    .eq("batch_id", batchId)
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (error !== null) {
    throw error;
  }

  const memories = (data ?? []).map(mapRow);
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
