import "server-only";

import { getMediaSignedUrl, getPrimaryMediaByMemoryIds } from "@/features/media/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { Memory, MemoryWithMedia } from "./types";

interface MemoryRow {
  id: string;
  batch_id: string;
  caption: string | null;
  event_name: string | null;
  occurred_on: string;
  created_at: string;
}

function mapRow(row: MemoryRow): Memory {
  return {
    id: row.id,
    batchId: row.batch_id,
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
 */
export async function listRecentMemories(batchId: string): Promise<MemoryWithMedia[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memories")
    .select("id, batch_id, caption, event_name, occurred_on, created_at")
    .eq("batch_id", batchId)
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (error !== null) {
    throw error;
  }

  const memories = (data ?? []).map(mapRow);
  const mediaByMemoryId = await getPrimaryMediaByMemoryIds(memories.map((memory) => memory.id));

  return Promise.all(
    memories.map(async (memory) => {
      const media = mediaByMemoryId.get(memory.id);
      const imageUrl =
        media === undefined
          ? null
          : await getMediaSignedUrl("batch-media", media.storagePath, {
              width: 480,
              height: 480,
            });
      return { ...memory, imageUrl };
    }),
  );
}
