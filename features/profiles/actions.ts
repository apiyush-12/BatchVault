"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import {
  avatarObjectPathSchema,
  deleteAccountInputSchema,
  onboardingInputSchema,
  updateProfileInputSchema,
} from "./schema";
import { GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Server Actions for the profiles domain (architecture §18.1).
 *
 * Fixed order throughout: authenticate → validate → authorize → execute →
 * revalidate → return/redirect (architecture §18.3). "Authorize" is
 * structural here — every write targets the caller's own row by construction
 * (`auth.uid()` inside RLS, or the RPC's own explicit check) — there is no
 * separate role check to perform in Phase 1.
 */

function normalizeBio(bio: string | undefined): string | null {
  return bio === undefined || bio === "" ? null : bio;
}

/**
 * Creates the caller's profile row if this is their first submission,
 * otherwise updates it. Deliberately separate from marking onboarding
 * complete: the avatar controlled-write path (below) requires the row to
 * already exist, and the onboarding form uploads an avatar, if any, between
 * saving these basics and completing onboarding.
 */
export async function saveOwnProfileAction(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = onboardingInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  }

  const { displayName, bio } = parsed.data;
  const bioValue = normalizeBio(bio);

  // Explicit, not left to RLS alone — see the identical fix and rationale
  // in features/profiles/queries.ts's getOwnProfile() (Phase 3B).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userData.user.id)
    .maybeSingle();

  const writeResult =
    existing === null
      ? await supabase
          .from("profiles")
          .insert({ display_name: displayName, bio: bioValue })
      : await supabase
          .from("profiles")
          .update({ display_name: displayName, bio: bioValue })
          .eq("id", userData.user.id);

  if (writeResult.error !== null) {
    logger.error("profiles.save_failed", { userId: userData.user.id });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/onboarding");
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

/**
 * The controlled write path (security.md §5.4.3): sets
 * onboarding_completed_at server-side for the caller's own row, then sends
 * them into the app. Never a direct column write, and never called before
 * `saveOwnProfileAction` has created the row it operates on.
 */
export async function markOnboardingCompleteAction(): Promise<{
  ok: false;
  error: string;
}> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("complete_onboarding");

  if (error !== null) {
    logger.error("profiles.complete_onboarding_failed", {});
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/home");
  revalidatePath("/settings");
  redirect("/home");
}

/** Edits the caller's own display name / bio from the settings screen. */
export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = updateProfileInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  }

  const { displayName, bio } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, bio: normalizeBio(bio) })
    .eq("id", userData.user.id);

  if (error !== null) {
    logger.error("profiles.update_failed", { userId: userData.user.id });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true, data: undefined };
}

/**
 * Composes a server-generated avatar path and requests a signed upload
 * target for it (architecture §7–8; security.md §6.1) — the client never
 * chooses or supplies the path.
 */
export async function requestAvatarUploadAction(): Promise<
  ActionResult<{ path: string; token: string }>
> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const path = `${userData.user.id}/${randomUUID()}`;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUploadUrl(path);

  if (error !== null || data === null) {
    logger.error("profiles.avatar_upload_request_failed", {
      userId: userData.user.id,
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, data: { path: data.path, token: data.token } };
}

/**
 * Records an avatar the caller already uploaded to their own preallocated
 * path, through the controlled write path (security.md §5.4.3) — never a
 * direct `avatar_path` column write.
 */
export async function confirmAvatarUploadAction(
  input: unknown,
): Promise<ActionResult<{ avatarUrl: string | null }>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = avatarObjectPathSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data, error } = await supabase.rpc("set_own_avatar_path", {
    object_path: parsed.data,
  });

  if (error !== null || data === null) {
    logger.error("profiles.set_avatar_path_failed", {
      userId: userData.user.id,
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  let avatarUrl: string | null = null;
  if (data.avatar_path !== null) {
    const signed = await supabase.storage
      .from("avatars")
      .createSignedUrl(data.avatar_path, 60);
    avatarUrl = signed.error === null ? signed.data.signedUrl : null;
  }

  revalidatePath("/settings");
  revalidatePath("/onboarding");
  return { ok: true, data: { avatarUrl } };
}

const OWNS_ACTIVE_BATCH_ERROR =
  "You own a batch. Make someone else the owner, or delete the batch, before deleting your account.";

/**
 * Permanent account deletion (security.md §22, B3, R4).
 *
 * `prepare_account_deletion` refuses while the caller still owns a live
 * batch (Q3: block pending transfer). Avatar objects are removed first,
 * with the caller's own client (object-first, security.md §24). Deleting the
 * Auth user is service-role call site 1 (security.md §12) and always targets
 * the authenticated caller's own id — never an id from the request. The
 * database cascade then removes the profile, memberships and reactions, and
 * sets authorship on shared memories/comments to NULL ("Former member").
 */
export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const userId = userData.user.id;

  const parsed = deleteAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { error: precheckError } = await supabase.rpc("prepare_account_deletion");
  if (precheckError !== null) {
    if (precheckError.message === "owns_active_batch") {
      return { ok: false, error: OWNS_ACTIVE_BATCH_ERROR };
    }
    logger.error("profiles.delete_account_precheck_failed", { userId });
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: avatarObjects, error: listError } = await supabase.storage
    .from("avatars")
    .list(userId, { limit: 100 });
  if (listError !== null) {
    logger.error("profiles.delete_account_avatar_list_failed", { userId });
    return { ok: false, error: GENERIC_ERROR };
  }
  if (avatarObjects.length > 0) {
    const { error: removeError } = await supabase.storage
      .from("avatars")
      .remove(avatarObjects.map((object) => `${userId}/${object.name}`));
    if (removeError !== null) {
      logger.error("profiles.delete_account_avatar_remove_failed", { userId });
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  const serviceRole = createSupabaseServiceRoleClient();
  const { error: deleteError } = await serviceRole.auth.admin.deleteUser(userId);
  if (deleteError !== null) {
    logger.error("profiles.delete_account_failed", { userId });
    return { ok: false, error: GENERIC_ERROR };
  }

  await supabase.auth.signOut();
  redirect("/sign-in");
}
