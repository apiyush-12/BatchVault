"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  approveMemberInputSchema,
  changeMemberRoleInputSchema,
  rejectMemberInputSchema,
  removeMemberInputSchema,
  transferOwnershipInputSchema,
} from "./schema";
import { GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Server Actions for the memberships write side (architecture §18.1; Phase
 * 3B). Fixed order throughout: authenticate → validate → authorize →
 * execute → revalidate → return (architecture §18.3). "Authorize" is each
 * privileged RPC's own job (security.md §4, §11, §5.2.2) — this layer never
 * re-implements a ceiling check, and never trusts a client-supplied role.
 */

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error !== null || data.user === null) {
    return null;
  }
  return { supabase, userId: data.user.id };
}

export async function approveMemberAction(input: unknown): Promise<ActionResult> {
  const session = await requireUser();
  if (session === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = approveMemberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { batchId, profileId } = parsed.data;

  const { error } = await session.supabase.rpc("approve_member", {
    p_batch_id: batchId,
    p_target_profile_id: profileId,
  });

  if (error !== null) {
    logger.error("memberships.approve_failed", { userId: session.userId, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/members`);
  return { ok: true, data: undefined };
}

export async function rejectMemberAction(input: unknown): Promise<ActionResult> {
  const session = await requireUser();
  if (session === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = rejectMemberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { batchId, profileId } = parsed.data;

  const { error } = await session.supabase.rpc("reject_member", {
    p_batch_id: batchId,
    p_target_profile_id: profileId,
  });

  if (error !== null) {
    logger.error("memberships.reject_failed", { userId: session.userId, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/members`);
  return { ok: true, data: undefined };
}

export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  const session = await requireUser();
  if (session === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = removeMemberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { batchId, profileId } = parsed.data;

  const { error } = await session.supabase.rpc("remove_member", {
    p_batch_id: batchId,
    p_target_profile_id: profileId,
  });

  if (error !== null) {
    // Same generic shape whether the actor lacks rank, the target is not
    // active, or anything else — indistinguishable denial (security.md §3).
    logger.error("memberships.remove_failed", { userId: session.userId, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/members`);
  return { ok: true, data: undefined };
}

export async function changeMemberRoleAction(input: unknown): Promise<ActionResult> {
  const session = await requireUser();
  if (session === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = changeMemberRoleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { batchId, profileId, newRole } = parsed.data;

  const { error } = await session.supabase.rpc("change_member_role", {
    p_batch_id: batchId,
    p_target_profile_id: profileId,
    p_new_role: newRole,
  });

  if (error !== null) {
    logger.error("memberships.change_role_failed", { userId: session.userId, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/members`);
  return { ok: true, data: undefined };
}

/**
 * The highest-tier confirmation this phase can build without a modal
 * primitive this repository has not yet vendored (design.md §13-16): the
 * caller must type the exact current display name of the person they are
 * transferring to — re-verified server-side, never trusted from the client
 * alone, since a client-side-only check is UX, not a guarantee.
 */
export async function transferOwnershipAction(input: unknown): Promise<ActionResult> {
  const session = await requireUser();
  if (session === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = transferOwnershipInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { batchId, newOwnerProfileId, confirmDisplayName } = parsed.data;

  const { data: profile, error: profileError } = await session.supabase
    .from("profiles")
    .select("display_name")
    .eq("id", newOwnerProfileId)
    .maybeSingle();

  if (
    profileError !== null ||
    profile === null ||
    profile.display_name.trim().toLowerCase() !== confirmDisplayName.trim().toLowerCase()
  ) {
    return { ok: false, error: "That name doesn't match. Please type it exactly to confirm." };
  }

  const { error } = await session.supabase.rpc("transfer_ownership", {
    p_batch_id: batchId,
    p_new_owner_profile_id: newOwnerProfileId,
  });

  if (error !== null) {
    logger.error("memberships.transfer_ownership_failed", { userId: session.userId, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/members`);
  revalidatePath(`/batches/${batchId}`);
  return { ok: true, data: undefined };
}
