import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { MediaAsset } from "./types";

interface MediaAssetRow {
  id: string;
  batch_id: string;
  memory_id: string | null;
  kind: "image" | "video";
  status: "pending" | "ready" | "rejected";
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
}

function mapRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    batchId: row.batch_id,
    memoryId: row.memory_id,
    kind: row.kind,
    status: row.status,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
  };
}

/** The `ready`, position-0 media asset for each memory id given. RLS admits only what the caller may see. */
export async function getPrimaryMediaByMemoryIds(
  memoryIds: string[],
): Promise<Map<string, MediaAsset>> {
  if (memoryIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, batch_id, memory_id, kind, status, storage_path, mime_type, byte_size")
    .in("memory_id", memoryIds)
    .eq("position", 0);

  if (error !== null) {
    throw error;
  }

  const byMemoryId = new Map<string, MediaAsset>();
  for (const row of (data ?? []) as MediaAssetRow[]) {
    if (row.memory_id !== null) {
      byMemoryId.set(row.memory_id, mapRow(row));
    }
  }
  return byMemoryId;
}

/**
 * A short-lived (15 minutes, R1) signed URL for the Storage transformation
 * rendition at the given dimensions (Q4: Storage image transformations) —
 * never cached by the Next.js image optimizer (R2), never persisted or
 * logged (security.md §8, §21).
 */
const SIGNED_URL_TTL_SECONDS = 15 * 60;

export async function getMediaSignedUrl(
  bucket: string,
  path: string,
  options?: { width?: number; height?: number },
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(
    path,
    SIGNED_URL_TTL_SECONDS,
    options !== undefined
      ? { transform: { width: options.width, height: options.height, resize: "cover" } }
      : undefined,
  );

  if (error !== null) {
    return null;
  }
  return data.signedUrl;
}
