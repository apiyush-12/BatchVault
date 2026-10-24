"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/media/types";
import { GENERIC_ERROR } from "@/features/media/types";

import { canEditMemory } from "./permissions";
import { editMemoryInputSchema } from "./schema";
import { getMemoryById } from "./queries";

/**
 * Author edit (phases.md Phase 4B; PRD #7, resolved 2026-10-24: edit only,
 * no self-delete). Fixed order: authenticate -> validate -> authorize ->
 * execute -> revalidate -> return (architecture §18.3). This is the one
 * place in the memories domain that writes with ordinary, policy-checked
 * direct DML rather than a privileged RPC — `memories_update_own` plus the
 * column-level GRANT (caption, event_name, occurred_on only) are the real
 * boundary; the lookup/ownership check here is Layer 2 only, for an honest
 * generic error before the database is even asked.
 */
export async function editMemoryAction(
  memoryId: string,
  input: unknown,
): Promise<ActionResult<{ memoryId: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = editMemoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const existing = await getMemoryById(memoryId);
  if (existing === null || !canEditMemory(existing.createdBy, userData.user.id)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { caption, eventName, occurredOn } = parsed.data;

  const { data: updated, error } = await supabase
    .from("memories")
    .update({
      caption: caption ?? null,
      event_name: eventName ?? null,
      occurred_on: occurredOn,
    })
    .eq("id", memoryId)
    .select("id, batch_id")
    .maybeSingle();

  if (error !== null || updated === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${updated.batch_id}/memories`);

  return { ok: true, data: { memoryId: updated.id } };
}
