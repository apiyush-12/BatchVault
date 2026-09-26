"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { createBatchInputSchema, updateBatchSettingsInputSchema } from "./schema";
import { GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Server Actions for the batches domain (architecture §18.1).
 *
 * Fixed order throughout: authenticate → validate → authorize → execute →
 * revalidate → return/redirect (architecture §18.3). "Authorize" for both
 * actions below is the privileged RPC's own job (security.md §5.2.1, §11) —
 * this layer never re-implements it, and never trusts a client-supplied
 * role or batch-ownership claim (security.md §13).
 */

// `undefined`, not `null`: create_batch's optional SQL parameters (a
// `default null`) are generated as an optional TS key (`p_course_name?:
// string`), which omitting/undefined satisfies directly with no cast.
function normalizeOptional(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

function normalizeGraduationYear(value: string | undefined): number | undefined {
  return value === undefined || value === "" ? undefined : Number(value);
}

// update_batch_settings' SQL parameters have no `default`, so the generator
// types every argument as required and non-null (`p_course_name: string`),
// even though the underlying columns are genuinely nullable and the function
// legitimately needs to clear one back to NULL. This is a known limitation
// of the generator reflecting function arguments (it does not do this for
// table columns, which do show `| null`) — not a real runtime restriction:
// Postgres accepts NULL for any of these unconstrained `text`/`smallint`
// parameters. The cast below is the single, narrow, documented exception
// this gap requires (rules.md §3).
type UpdateBatchSettingsArgs = Database["public"]["Functions"]["update_batch_settings"]["Args"];

/**
 * Creates a batch and its owner membership atomically via `create_batch`
 * (security.md §5.2.1) and sends the new owner straight into it.
 */
export async function createBatchAction(
  input: unknown,
): Promise<{ ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = createBatchInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const {
    name,
    institutionName,
    courseName,
    departmentName,
    graduationYear,
    section,
    description,
    joinPolicy,
  } = parsed.data;

  const { data, error } = await supabase.rpc("create_batch", {
    p_name: name,
    p_institution_name: institutionName,
    p_course_name: normalizeOptional(courseName),
    p_department_name: normalizeOptional(departmentName),
    p_graduation_year: normalizeGraduationYear(graduationYear),
    p_section: normalizeOptional(section),
    p_description: normalizeOptional(description),
    p_join_policy: joinPolicy,
  });

  if (error !== null || data === null) {
    logger.error("batches.create_failed", { userId: userData.user.id });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/home");
  redirect(`/batches/${data.id}`);
}

/** Admin+ batch settings change via `update_batch_settings` (security.md §11, §20). */
export async function updateBatchSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = updateBatchSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const {
    batchId,
    name,
    institutionName,
    courseName,
    departmentName,
    graduationYear,
    section,
    description,
    joinPolicy,
  } = parsed.data;

  const { error } = await supabase.rpc("update_batch_settings", {
    p_batch_id: batchId,
    p_name: name,
    p_institution_name: institutionName,
    p_course_name: normalizeOptional(courseName) ?? null,
    p_department_name: normalizeOptional(departmentName) ?? null,
    p_graduation_year: normalizeGraduationYear(graduationYear) ?? null,
    p_section: normalizeOptional(section) ?? null,
    p_description: normalizeOptional(description) ?? null,
    p_join_policy: joinPolicy,
  } as UpdateBatchSettingsArgs);

  if (error !== null) {
    // Deliberately generic: this is the same shape whether the batch does
    // not exist or the caller simply lacks admin+ authority in it
    // (security.md §3, "indistinguishable denial").
    logger.error("batches.update_settings_failed", {
      userId: userData.user.id,
      batchId,
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}`);
  revalidatePath(`/batches/${batchId}/settings`);
  return { ok: true, data: undefined };
}
