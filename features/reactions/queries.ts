import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ReactionKind, ReactionSummary } from "./types";

/** "Who felt what" (database.md §3.8) — counts per kind, never an accumulating like counter, plus the caller's own reaction if any. */
export async function getReactionSummary(memoryId: string): Promise<ReactionSummary> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("reactions")
    .select("profile_id, kind")
    .eq("memory_id", memoryId);

  if (error !== null) {
    throw error;
  }

  const counts: Partial<Record<ReactionKind, number>> = {};
  let myReaction: ReactionKind | null = null;
  for (const row of data ?? []) {
    const kind = row.kind as ReactionKind;
    counts[kind] = (counts[kind] ?? 0) + 1;
    if (userData.user !== null && row.profile_id === userData.user.id) {
      myReaction = kind;
    }
  }

  return { counts, myReaction };
}
