import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * The deleted-batch reaper (PRD #6; database.md §24). Service-role call
 * site 2 (security.md §12: a bounded cron job with no user present).
 *
 * Secret first, then object-first: every Storage object under a due batch's
 * prefix is removed BEFORE `purge_batch` deletes the row (and, by cascade,
 * its whole subtree). `purge_batch` itself refuses while any object remains,
 * so a partial run just leaves the batch for the next one. The 30-day window
 * lives in the database functions; this route cannot shorten it.
 */
const MAX_BATCHES_PER_RUN = 10;
const OBJECT_PAGE_SIZE = 500;
const MAX_PAGES_PER_BATCH = 20;

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "not authorized" }, { status: 401 });
  }

  const serviceRole = createSupabaseServiceRoleClient();

  const { data: batchIds, error: listError } = await serviceRole.rpc("list_reapable_batches", {
    p_limit: MAX_BATCHES_PER_RUN,
  });

  if (listError !== null) {
    logger.error("batches.reap_list_failed", { message: listError.message });
    return NextResponse.json({ error: "reap failed" }, { status: 500 });
  }

  let purgedCount = 0;

  for (const batchId of batchIds ?? []) {
    let objectsCleared = false;

    for (let page = 0; page < MAX_PAGES_PER_BATCH; page += 1) {
      const { data: objects, error: objectsError } = await serviceRole.rpc(
        "list_batch_storage_objects",
        { p_batch_id: batchId, p_limit: OBJECT_PAGE_SIZE },
      );

      if (objectsError !== null) {
        logger.warn("batches.reap_object_list_failed", { batchId, message: objectsError.message });
        break;
      }
      if (objects.length === 0) {
        objectsCleared = true;
        break;
      }

      const { error: removeError } = await serviceRole.storage
        .from("batch-media")
        .remove(objects.map((object) => object.name));

      if (removeError !== null) {
        logger.warn("batches.reap_object_delete_failed", { batchId, message: removeError.message });
        break;
      }
    }

    if (!objectsCleared) {
      continue;
    }

    const { data: purged, error: purgeError } = await serviceRole.rpc("purge_batch", {
      p_batch_id: batchId,
    });

    if (purgeError !== null) {
      logger.warn("batches.reap_purge_failed", { batchId, message: purgeError.message });
      continue;
    }
    if (purged) {
      purgedCount += 1;
    }
  }

  logger.info("batches.reap_completed", {
    candidateCount: batchIds?.length ?? 0,
    purgedCount,
  });

  return NextResponse.json({ candidateCount: batchIds?.length ?? 0, purgedCount });
}
