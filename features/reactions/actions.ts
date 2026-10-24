"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { setReactionInputSchema } from "./schema";
import { GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Create or switch the caller's own reaction (database.md §3.8; security.md
 * §5.4). `UNIQUE (memory_id, profile_id)` means "switch" is just an upsert
 * on that key — ordinary policy-checked direct DML, never an RPC.
 */
export async function setReactionAction(input: unknown): Promise<ActionResult<{ batchId: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = setReactionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: memory } = await supabase
    .from("memories")
    .select("batch_id")
    .eq("id", parsed.data.memoryId)
    .maybeSingle();
  if (memory === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Try INSERT first (the common "react for the first time" case); on the
  // UNIQUE (memory_id, profile_id) conflict, fall back to UPDATE kind only
  // — deliberately NOT a Supabase `.upsert()`, which would ask PostgREST to
  // also rewrite `batch_id`/`memory_id` on conflict and fail the
  // column-level grant that correctly excludes them (security.md §5.4.1).
  const { error: insertError } = await supabase
    .from("reactions")
    .insert({ batch_id: memory.batch_id, memory_id: parsed.data.memoryId, kind: parsed.data.kind });

  if (insertError !== null) {
    if (insertError.code !== "23505") {
      return { ok: false, error: GENERIC_ERROR };
    }
    const { error: updateError } = await supabase
      .from("reactions")
      .update({ kind: parsed.data.kind })
      .eq("memory_id", parsed.data.memoryId)
      .eq("profile_id", userData.user.id);
    if (updateError !== null) {
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  revalidatePath(`/batches/${memory.batch_id}/memories/${parsed.data.memoryId}`);

  return { ok: true, data: { batchId: memory.batch_id } };
}

/** Remove the caller's own reaction (hard delete — database.md §3.8). */
export async function removeReactionAction(memoryId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: memory } = await supabase
    .from("memories")
    .select("batch_id")
    .eq("id", memoryId)
    .maybeSingle();

  const { error } = await supabase
    .from("reactions")
    .delete()
    .eq("memory_id", memoryId)
    .eq("profile_id", userData.user.id);

  if (error !== null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  if (memory !== null) {
    revalidatePath(`/batches/${memory.batch_id}/memories/${memoryId}`);
  }

  return { ok: true, data: undefined };
}
