import "server-only";

import { getProfilesByIds } from "@/features/profiles/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { Comment } from "./types";

interface CommentRow {
  id: string;
  batch_id: string;
  memory_id: string;
  author_id: string | null;
  body: string;
  edited_at: string | null;
  created_at: string;
}

/**
 * Flat comment thread for a memory (phases.md Phase 6; database.md §3.7).
 * RLS's `comments_select_visible` already enforces parent-memory visibility
 * (security.md §5.4.2) — this query trusts that, never re-filtering
 * client-side (architecture §11).
 */
export async function listComments(memoryId: string): Promise<Comment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, batch_id, memory_id, author_id, body, edited_at, created_at")
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: true });

  if (error !== null) {
    throw error;
  }

  const rows = (data ?? []) as CommentRow[];
  const authorIds = rows.map((row) => row.author_id).filter((id): id is string => id !== null);
  const profiles = await getProfilesByIds(authorIds);
  const nameById = new Map(profiles.map((profile) => [profile.id, profile.displayName]));

  return rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    memoryId: row.memory_id,
    authorId: row.author_id,
    authorDisplayName: row.author_id !== null ? (nameById.get(row.author_id) ?? "A former member") : "A former member",
    body: row.body,
    editedAt: row.edited_at,
    createdAt: row.created_at,
  }));
}
