import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

/**
 * The orphan-and-rejected media sweep (architecture §13; database.md §24;
 * phases.md Phase 4B). One of the three legitimate service-role call sites
 * (security.md §12 item 2: "a bounded cron/cleanup job acting across
 * batches with no user present").
 *
 * Order of operations (architecture §18.9): verify the shared secret FIRST
 * — before anything else, including parsing any body (this route has
 * none). Then object-first deletion (database.md §24): delete/confirm-gone
 * every Storage object BEFORE the row that names it is purged, never the
 * reverse, so a mid-run failure never strands bytes with no row pointing
 * at them — it just leaves the row for the next run to retry (idempotent).
 *
 * Bounded (architecture §13: "no job queue... idempotent cron sweeps"):
 * capped per run so one invocation cannot run unbounded against a large
 * table; a backlog larger than the cap is simply finished by the next run.
 */
const GRACE_SECONDS = 24 * 60 * 60; // 24h grace for an in-flight pending upload.
const MAX_PER_RUN = 200;

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "not authorized" }, { status: 401 });
  }

  const serviceRole = createSupabaseServiceRoleClient();

  const { data: candidates, error: listError } = await serviceRole.rpc("list_sweepable_media", {
    p_grace_seconds: GRACE_SECONDS,
  });

  if (listError !== null) {
    logger.error("media.sweep_list_failed", { message: listError.message });
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }

  const batch = (candidates ?? []).slice(0, MAX_PER_RUN);
  const confirmedGoneIds: string[] = [];

  for (const row of batch) {
    const { error: removeError } = await serviceRole.storage
      .from(row.storage_bucket)
      .remove([row.storage_path]);

    // Storage's own remove is itself idempotent — removing an
    // already-absent object is not an error. Any OTHER failure (network,
    // permission) is logged and the row is simply left for the next run;
    // it is never purged without a confirmed-gone object (object-first).
    if (removeError === null) {
      confirmedGoneIds.push(row.id);
    } else {
      logger.warn("media.sweep_object_delete_failed", {
        mediaAssetId: row.id,
        message: removeError.message,
      });
    }
  }

  let purgedCount = 0;
  if (confirmedGoneIds.length > 0) {
    const { data: purged, error: purgeError } = await serviceRole.rpc("purge_swept_media", {
      p_media_asset_ids: confirmedGoneIds,
    });

    if (purgeError !== null) {
      logger.error("media.sweep_purge_failed", { message: purgeError.message });
      return NextResponse.json({ error: "sweep failed" }, { status: 500 });
    }
    purgedCount = purged?.length ?? 0;
  }

  logger.info("media.sweep_completed", {
    candidateCount: batch.length,
    purgedCount,
  });

  return NextResponse.json({ candidateCount: batch.length, purgedCount });
}
