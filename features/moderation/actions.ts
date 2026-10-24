"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  contentActionInputSchema,
  createReportInputSchema,
  resolveReportInputSchema,
} from "./schema";
import { GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Report creation (phases.md Phase 8A) — RPC-only (security.md §13): the
 * target is resolved and `batch_id` derived server-side, inside
 * `create_report` itself. This layer validates shape only.
 */
export async function createReportAction(input: unknown): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = createReportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { error } = await supabase.rpc("create_report", {
    p_target_kind: parsed.data.targetKind,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? null,
  });

  if (error !== null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, data: undefined };
}

/** Mod+ report resolution (phases.md Phase 8A), audited inside the RPC. */
export async function resolveReportAction(batchId: string, input: unknown): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = resolveReportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase.rpc("resolve_report", {
    p_report_id: parsed.data.reportId,
    p_resolution_note: parsed.data.resolutionNote ?? null,
  });

  if (error !== null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/moderation`);
  return { ok: true, data: undefined };
}

/** Mod+ soft-delete of a memory or comment (phases.md Phase 8A), audited inside the RPC. */
export async function removeContentAction(batchId: string, input: unknown): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = contentActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase.rpc("remove_content", {
    p_target_kind: parsed.data.targetKind,
    p_target_id: parsed.data.targetId,
  });

  if (error !== null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/moderation`);
  revalidatePath(`/batches/${batchId}/memories`);
  return { ok: true, data: undefined };
}

/** Mod+ restoration within the retention window (PRD #5), audited inside the RPC. */
export async function restoreContentAction(batchId: string, input: unknown): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = contentActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase.rpc("restore_content", {
    p_target_kind: parsed.data.targetKind,
    p_target_id: parsed.data.targetId,
  });

  if (error !== null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/moderation`);
  return { ok: true, data: undefined };
}
