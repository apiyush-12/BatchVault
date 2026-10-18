"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import { stripExifIfSupported } from "./exif";
import { finalizeMemoryInputSchema, requestPhotoUploadInputSchema } from "./schema";
import { GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Server Actions for the media domain (architecture §18.1; §8's two-phase
 * upload flow). Fixed order throughout: authenticate → validate →
 * authorize → execute → revalidate → return (architecture §18.3).
 * "Authorize" is `preallocate_media`/`finalize_memory`'s own job
 * (security.md §5.2) — this layer never re-implements it.
 *
 * `features/media` is the only module that talks to Storage
 * (architecture §17).
 */

export async function requestPhotoUploadAction(
  input: unknown,
): Promise<ActionResult<{ mediaAssetId: string; path: string; token: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = requestPhotoUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { batchId, declaredMimeType, declaredSize, originalFilename } = parsed.data;

  const { data: asset, error } = await supabase.rpc("preallocate_media", {
    p_batch_id: batchId,
    p_declared_mime_type: declaredMimeType,
    p_declared_size: declaredSize,
    p_original_filename: originalFilename ?? null,
  });

  if (error !== null || asset === null) {
    logger.error("media.preallocate_failed", { userId: userData.user.id, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(asset.storage_bucket)
    .createSignedUploadUrl(asset.storage_path);

  if (signError !== null || signed === null) {
    logger.error("media.sign_upload_url_failed", { userId: userData.user.id, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, data: { mediaAssetId: asset.id, path: signed.path, token: signed.token } };
}

/**
 * Finalize (architecture §8 step 4). For a `pending` asset, performs the
 * one deliberate exception to "bytes never proxy through the server"
 * (security.md §27 B1): downloads the uploaded object, strips EXIF for
 * JPEG, and re-uploads the result to the same path — the uploader's own
 * still-pending-object permission (security.md §6.2), not a new privilege.
 * Then calls `finalize_memory`, which re-verifies everything server-side.
 */
export async function finalizeMemoryAction(
  input: unknown,
): Promise<ActionResult<{ memoryId: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = finalizeMemoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { mediaAssetId, caption, eventName, occurredOn } = parsed.data;

  const { data: assetRow, error: assetError } = await supabase
    .from("media_assets")
    .select("status, storage_bucket, storage_path")
    .eq("id", mediaAssetId)
    .maybeSingle();

  if (assetError !== null || assetRow === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Only a still-pending asset needs the strip-and-reupload step — an
  // idempotent retry of an already-`ready` asset must not re-touch Storage.
  if (assetRow.status === "pending") {
    const { data: downloaded, error: downloadError } = await supabase.storage
      .from(assetRow.storage_bucket)
      .download(assetRow.storage_path);

    if (downloadError !== null || downloaded === null) {
      logger.error("media.download_for_strip_failed", {
        userId: userData.user.id,
        mediaAssetId,
      });
      return { ok: false, error: GENERIC_ERROR };
    }

    const mimeType = downloaded.type;
    const originalBytes = Buffer.from(await downloaded.arrayBuffer());
    const strippedBytes = stripExifIfSupported(mimeType, originalBytes);

    const { error: reuploadError } = await supabase.storage
      .from(assetRow.storage_bucket)
      .upload(assetRow.storage_path, strippedBytes, { contentType: mimeType, upsert: true });

    if (reuploadError !== null) {
      logger.error("media.reupload_after_strip_failed", {
        userId: userData.user.id,
        mediaAssetId,
      });
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  const { data: memory, error } = await supabase.rpc("finalize_memory", {
    p_media_asset_id: mediaAssetId,
    p_caption: caption ?? null,
    p_event_name: eventName ?? null,
    p_occurred_on: occurredOn,
  });

  if (error !== null || memory === null) {
    await cleanupIfRejected(mediaAssetId);
    logger.error("media.finalize_failed", { userId: userData.user.id, mediaAssetId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${memory.batch_id}/memories`);
  revalidatePath(`/batches/${memory.batch_id}`);

  return { ok: true, data: { memoryId: memory.id } };
}

/**
 * Object-first rejection cleanup (database.md §3.6, §24; security.md §12
 * call site 2). The Storage object's backing bytes are deleted via the
 * service-role client — a raw SQL `DELETE` on `storage.objects` would not
 * trigger the backend's physical deletion, and ordinary members hold no
 * Storage delete grant (security.md §6.2) — only after which the row is
 * purged, as the real authenticated user, via `purge_rejected_media`.
 * A failure here leaves the row `rejected` for Phase 4B's cron sweep to
 * retry (architecture §13) — never a silent swallow.
 */
async function cleanupIfRejected(mediaAssetId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("media_assets")
    .select("status, storage_bucket, storage_path")
    .eq("id", mediaAssetId)
    .maybeSingle();

  if (row === null || row.status !== "rejected") {
    return;
  }

  const serviceRole = createSupabaseServiceRoleClient();
  const { error: removeError } = await serviceRole.storage
    .from(row.storage_bucket)
    .remove([row.storage_path]);

  if (removeError !== null) {
    logger.error("media.rejected_object_delete_failed", { mediaAssetId });
    return;
  }

  const { error: purgeError } = await supabase.rpc("purge_rejected_media", {
    p_media_asset_id: mediaAssetId,
  });
  if (purgeError !== null) {
    logger.error("media.purge_rejected_row_failed", { mediaAssetId });
  }
}
