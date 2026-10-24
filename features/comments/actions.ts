"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { canEditComment } from "./permissions";
import { createCommentInputSchema, editCommentInputSchema } from "./schema";
import { GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Create a comment (phases.md Phase 6) — ordinary policy-checked direct DML
 * (security.md §5.4), never an RPC. `author_id` is never sent by the client
 * at all (DEFAULT auth.uid(), no INSERT grant on that column) — RLS and the
 * column grant are the real boundary; this layer only gives an honest
 * generic error instead of a raw PostgREST one.
 */
export async function createCommentAction(
  input: unknown,
): Promise<ActionResult<{ commentId: string; batchId: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = createCommentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  // batch_id is required by the table but not client-trusted for anything —
  // resolved from the memory itself so a forged batch_id can never slip in
  // (the composite FK would reject a mismatch anyway; this just avoids the
  // round trip).
  const { data: memory, error: memoryError } = await supabase
    .from("memories")
    .select("batch_id")
    .eq("id", parsed.data.memoryId)
    .maybeSingle();
  if (memoryError !== null || memory === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: created, error } = await supabase
    .from("comments")
    .insert({ batch_id: memory.batch_id, memory_id: parsed.data.memoryId, body: parsed.data.body })
    .select("id")
    .maybeSingle();

  if (error !== null || created === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${memory.batch_id}/memories/${parsed.data.memoryId}`);

  return { ok: true, data: { commentId: created.id, batchId: memory.batch_id } };
}

/** Author edit of their own comment body (security.md §5.4, direct DML). */
export async function editCommentAction(
  commentId: string,
  input: unknown,
): Promise<ActionResult<{ commentId: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = editCommentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { data: existing } = await supabase
    .from("comments")
    .select("author_id, batch_id, memory_id")
    .eq("id", commentId)
    .maybeSingle();
  if (existing === null || !canEditComment(existing.author_id, userData.user.id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: updated, error } = await supabase
    .from("comments")
    .update({ body: parsed.data.body })
    .eq("id", commentId)
    .select("id")
    .maybeSingle();

  if (error !== null || updated === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${existing.batch_id}/memories/${existing.memory_id}`);

  return { ok: true, data: { commentId: updated.id } };
}
