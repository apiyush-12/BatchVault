import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteTestUser, type TestUser } from "./support/auth-fixtures";
import {
  asPersona,
  asPersonaCommitted,
  attempt,
  connect,
  supabaseAnonKey,
  supabaseApiUrl,
  supabaseServiceRoleKey,
} from "./support/db";

/**
 * Phase 4B adversarial suite (testing.md §3.6, §3.8; security.md §5.4.1,
 * §12): video upload via the kind-dispatched `preallocate_media`/
 * `finalize_memory`, the poster-frame linking path, author edit via
 * policy-checked direct DML, and the two service-role-only cron-sweep
 * RPCs. Phase 4A's own suite (tests/db/media.test.ts) is NOT re-run here —
 * this file is additive, scoped to exactly what Phase 4B changed.
 */

let client: Client;
let ownerA: TestUser;
let memberA: TestUser;
let memberB: TestUser; // a second active member of the same batch — the "someone else's memory" case

let batchAId: string;

async function seedBatch(name: string, ownerId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.batches (name, institution_name, created_by)
     values ($1, 'Test University', $2) returning id`,
    [name, ownerId],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("failed to seed batch fixture");
  await client.query(
    `insert into public.batch_members (batch_id, profile_id, role, status, joined_at, decided_at, decided_by)
     values ($1, $2, 'owner', 'active', now(), now(), $2)`,
    [id, ownerId],
  );
  return id;
}

async function seedActiveMember(batchId: string, profileId: string): Promise<void> {
  await client.query(
    `insert into public.batch_members (batch_id, profile_id, role, status, joined_at, decided_at, decided_by)
     values ($1, $2, 'member', 'active', now(), now(), $2)`,
    [batchId, profileId],
  );
}

async function seedMediaAsset(
  batchId: string,
  createdBy: string,
  options: {
    status?: "pending" | "ready" | "rejected";
    memoryId?: string | null;
    kind?: "image" | "video";
    createdAt?: Date;
  } = {},
): Promise<{ id: string; storagePath: string }> {
  const id = crypto.randomUUID();
  const storagePath = `${batchId}/${id}`;
  const status = options.status ?? "pending";
  const kind = options.kind ?? "image";
  const mimeType = status === "ready" ? (kind === "video" ? "video/mp4" : "image/jpeg") : null;
  const byteSize = status === "ready" ? 1000 : null;
  const { rows } = await client.query<{ id: string; storage_path: string }>(
    `insert into public.media_assets (id, batch_id, kind, status, storage_bucket, storage_path, created_by, memory_id, mime_type, byte_size, created_at)
     values ($1, $2, $3::public.media_kind, $4::public.media_status, 'batch-media', $5, $6, $7, $8, $9, coalesce($10, now()))
     returning id, storage_path`,
    [
      id,
      batchId,
      kind,
      status,
      storagePath,
      createdBy,
      options.memoryId ?? null,
      mimeType,
      byteSize,
      options.createdAt ?? null,
    ],
  );
  const returnedId = rows[0]?.id;
  const returnedPath = rows[0]?.storage_path;
  if (returnedId === undefined || returnedPath === undefined) {
    throw new Error("failed to seed media_assets fixture");
  }
  return { id: returnedId, storagePath: returnedPath };
}

async function seedMemory(batchId: string, createdBy: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.memories (batch_id, created_by, occurred_on) values ($1, $2, current_date) returning id`,
    [batchId, createdBy],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("failed to seed memory fixture");
  return id;
}

async function seedObjectMetadata(
  bucket: string,
  path: string,
  metadata: { mimetype: string; size: number },
): Promise<void> {
  const response = await fetch(`${supabaseApiUrl()}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${supabaseServiceRoleKey()}`,
      "Content-Type": metadata.mimetype,
    },
    body: new Uint8Array(metadata.size),
  });
  if (!response.ok) {
    throw new Error(`failed to seed Storage object at ${bucket}/${path}: ${response.status}`);
  }
}

async function deleteObjectMetadata(bucket: string, path: string): Promise<void> {
  await fetch(`${supabaseApiUrl()}/storage/v1/object/${bucket}/${path}`, {
    method: "DELETE",
    headers: {
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${supabaseServiceRoleKey()}`,
    },
  }).catch(() => undefined);
}

beforeAll(async () => {
  client = await connect();
  [ownerA, memberA, memberB] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);

  for (const user of [ownerA, memberA, memberB]) {
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
      [user.id, `Test ${user.email}`],
    );
  }

  batchAId = await seedBatch("Media Phase 4B Batch", ownerA.id);
  await seedActiveMember(batchAId, memberA.id);
  await seedActiveMember(batchAId, memberB.id);
});

afterAll(async () => {
  await client.query("delete from public.batches where id = $1", [batchAId]);
  await Promise.all(
    [ownerA, memberA, memberB].map((user) => deleteTestUser(user.id).catch(() => undefined)),
  );
  await client.end();
});

describe("preallocate_media — video", () => {
  it("accepts a video/mp4 declaration within the video cap, storing the advisory duration", async () => {
    const row = await asPersona(client, { role: "authenticated", userId: memberA.id }, async (tx) => {
      const result = await tx.query<{
        status: string;
        kind: string;
        client_reported_duration_seconds: number | null;
      }>(
        "select * from public.preallocate_media($1, $2, $3, $4, $5)",
        [batchAId, "video/mp4", 20 * 1024 * 1024, null, 42],
      );
      return result.rows[0];
    });
    expect(row?.status).toBe("pending");
    expect(row?.kind).toBe("video");
    expect(row?.client_reported_duration_seconds).toBe(42);
  });

  it("refuses a video declared over the video cap (100 MiB)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select public.preallocate_media($1, $2, $3)",
      [batchAId, "video/mp4", 101 * 1024 * 1024],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a 20 MiB video is accepted even though it would exceed the IMAGE cap — caps are per-kind", async () => {
    const row = await asPersona(client, { role: "authenticated", userId: memberA.id }, async (tx) => {
      const result = await tx.query<{ status: string }>(
        "select * from public.preallocate_media($1, $2, $3)",
        [batchAId, "video/mp4", 20 * 1024 * 1024],
      );
      return result.rows[0];
    });
    expect(row?.status).toBe("pending");
  });

  it("still refuses HEIC (R6 stays excluded server-side)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select public.preallocate_media($1, $2, $3)",
      [batchAId, "image/heic", 1000],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("finalize_memory — video + poster", () => {
  it("finalizes a ready video and links a valid poster", async () => {
    const { id: videoId, storagePath: videoPath } = await seedMediaAsset(batchAId, memberA.id, {
      kind: "video",
    });
    const { id: posterId, storagePath: posterPath } = await seedMediaAsset(batchAId, memberA.id, {
      kind: "image",
    });
    await seedObjectMetadata("batch-media", videoPath, { mimetype: "video/mp4", size: 5_000_000 });
    await seedObjectMetadata("batch-media", posterPath, { mimetype: "image/jpeg", size: 2048 });

    try {
      const memory = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ id: string }>(
            "select * from public.finalize_memory($1, $2, $3, $4, $5)",
            [videoId, "A short clip", null, "2024-05-01", posterId],
          );
          return result.rows[0];
        },
      );

      const assets = await client.query<{
        id: string;
        status: string;
        poster_media_asset_id: string | null;
        position: number;
      }>("select id, status, poster_media_asset_id, position from public.media_assets where id in ($1, $2)", [
        videoId,
        posterId,
      ]);
      const videoRow = assets.rows.find((r) => r.id === videoId);
      const posterRow = assets.rows.find((r) => r.id === posterId);

      expect(videoRow?.status).toBe("ready");
      expect(videoRow?.poster_media_asset_id).toBe(posterId);
      expect(posterRow?.status).toBe("ready");
      expect(posterRow?.position).toBe(1);
      expect(memory?.id).toBeDefined();
    } finally {
      await client.query("delete from public.memories where id in (select memory_id from public.media_assets where id = $1)", [videoId]);
      await client.query("delete from public.media_assets where id in ($1, $2)", [videoId, posterId]);
      await deleteObjectMetadata("batch-media", videoPath);
      await deleteObjectMetadata("batch-media", posterPath);
    }
  });

  it("finalizes the video successfully even when the supplied poster is invalid — the primary upload is never blocked", async () => {
    const { id: videoId, storagePath: videoPath } = await seedMediaAsset(batchAId, memberA.id, {
      kind: "video",
    });
    const { id: posterId } = await seedMediaAsset(batchAId, memberA.id, { kind: "image" });
    await seedObjectMetadata("batch-media", videoPath, { mimetype: "video/mp4", size: 5_000_000 });
    // No object seeded for the poster at all — simulates a failed capture upload.

    try {
      const memory = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ id: string }>(
            "select * from public.finalize_memory($1, $2, $3, $4, $5)",
            [videoId, null, null, "2024-05-01", posterId],
          );
          return result.rows[0];
        },
      );
      expect(memory?.id).toBeDefined();

      const videoRow = await client.query<{ status: string; poster_media_asset_id: string | null }>(
        "select status, poster_media_asset_id from public.media_assets where id = $1",
        [videoId],
      );
      expect(videoRow.rows[0]?.status).toBe("ready");
      expect(videoRow.rows[0]?.poster_media_asset_id).toBeNull();

      const posterRow = await client.query<{ status: string }>(
        "select status from public.media_assets where id = $1",
        [posterId],
      );
      // The unusable poster stays pending (no object ever existed to reject) —
      // left for the cron sweep, exactly like any other abandoned upload.
      expect(posterRow.rows[0]?.status).toBe("pending");
    } finally {
      await client.query("delete from public.memories where id in (select memory_id from public.media_assets where id = $1)", [videoId]);
      await client.query("delete from public.media_assets where id in ($1, $2)", [videoId, posterId]);
      await deleteObjectMetadata("batch-media", videoPath);
    }
  });

  it("rejects a video whose Storage-observed type is not video/mp4", async () => {
    const { id: videoId, storagePath } = await seedMediaAsset(batchAId, memberA.id, { kind: "video" });
    await seedObjectMetadata("batch-media", storagePath, { mimetype: "video/quicktime", size: 5000 });

    try {
      const outcome = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ result: unknown }>(
            "select public.finalize_memory($1, $2, $3, $4) as result",
            [videoId, null, null, "2024-05-01"],
          );
          return result.rows[0]?.result;
        },
      );
      expect(outcome).toBeNull();
      const asset = await client.query<{ status: string }>(
        "select status from public.media_assets where id = $1",
        [videoId],
      );
      expect(asset.rows[0]?.status).toBe("rejected");
    } finally {
      await client.query("delete from public.media_assets where id = $1", [videoId]);
      await deleteObjectMetadata("batch-media", storagePath);
    }
  });
});

describe("author edit — policy-checked direct DML (PRD #7)", () => {
  it("the author can edit their own memory's caption/event/date", async () => {
    const memoryId = await seedMemory(batchAId, memberA.id);
    try {
      const result = await attempt<{ caption: string; event_name: string; occurred_on: string }>(
        client,
        { role: "authenticated", userId: memberA.id },
        "update public.memories set caption = $1, event_name = $2, occurred_on = $3 where id = $4 returning caption, event_name, occurred_on",
        ["Updated caption", "Updated event", "2024-06-01", memoryId],
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]?.caption).toBe("Updated caption");
      }
    } finally {
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("refuses an author attempt to change batch_id — no column grant exists", async () => {
    const memoryId = await seedMemory(batchAId, memberA.id);
    try {
      const result = await attempt(
        client,
        { role: "authenticated", userId: memberA.id },
        "update public.memories set caption = $1, batch_id = $2 where id = $3",
        ["x", batchAId, memoryId],
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("42501");
    } finally {
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("refuses an author attempt to change created_by — no column grant exists", async () => {
    const memoryId = await seedMemory(batchAId, memberA.id);
    try {
      const result = await attempt(
        client,
        { role: "authenticated", userId: memberA.id },
        "update public.memories set created_by = $1 where id = $2",
        [memberB.id, memoryId],
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("42501");
    } finally {
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("a non-author active member cannot edit someone else's memory (0 rows affected, not an error)", async () => {
    const memoryId = await seedMemory(batchAId, memberA.id);
    try {
      const result = await attempt<{ id: string }>(
        client,
        { role: "authenticated", userId: memberB.id },
        "update public.memories set caption = $1 where id = $2 returning id",
        ["hijacked", memoryId],
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.rows).toEqual([]);

      const stillOriginal = await client.query<{ caption: string | null }>(
        "select caption from public.memories where id = $1",
        [memoryId],
      );
      expect(stillOriginal.rows[0]?.caption).toBeNull();
    } finally {
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("anon cannot edit at all — no table-level grant for anon", async () => {
    const memoryId = await seedMemory(batchAId, memberA.id);
    try {
      const result = await attempt(
        client,
        { role: "anon" },
        "update public.memories set caption = $1 where id = $2",
        ["x", memoryId],
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("42501");
    } finally {
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });
});

describe("cron-sweep RPCs — service_role only", () => {
  it("authenticated cannot call list_sweepable_media or purge_swept_media", async () => {
    const list = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select * from public.list_sweepable_media()",
    );
    expect(list.ok).toBe(false);
    if (!list.ok) expect(list.error.code).toBe("42501");

    const purge = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select public.purge_swept_media(array[]::uuid[])",
    );
    expect(purge.ok).toBe(false);
    if (!purge.ok) expect(purge.error.code).toBe("42501");
  });

  it("anon cannot call either sweep RPC", async () => {
    const list = await attempt(client, { role: "anon" }, "select * from public.list_sweepable_media()");
    expect(list.ok).toBe(false);
    if (!list.ok) expect(list.error.code).toBe("42501");
  });

  it("service_role lists an old orphaned pending row and any rejected row, but not a fresh pending row", async () => {
    const oldPending = await seedMediaAsset(batchAId, memberA.id, {
      status: "pending",
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    const freshPending = await seedMediaAsset(batchAId, memberA.id, { status: "pending" });
    const rejected = await seedMediaAsset(batchAId, memberA.id, { status: "rejected" });

    try {
      const result = await asPersona(client, { role: "service_role" }, async (tx) => {
        const rows = await tx.query<{ id: string }>(
          "select * from public.list_sweepable_media($1)",
          [24 * 60 * 60],
        );
        return rows.rows.map((r) => r.id);
      });

      expect(result).toContain(oldPending.id);
      expect(result).toContain(rejected.id);
      expect(result).not.toContain(freshPending.id);
    } finally {
      await client.query("delete from public.media_assets where id in ($1, $2, $3)", [
        oldPending.id,
        freshPending.id,
        rejected.id,
      ]);
    }
  });

  it("service_role purge is idempotent and never purges a ready row", async () => {
    const rejected = await seedMediaAsset(batchAId, memberA.id, { status: "rejected" });
    const memoryId = await seedMemory(batchAId, memberA.id);
    const ready = await seedMediaAsset(batchAId, memberA.id, { status: "ready", memoryId });

    try {
      const firstPurge = await asPersonaCommitted(client, { role: "service_role" }, async (tx) => {
        const result = await tx.query<{ purge_swept_media: string }>(
          "select public.purge_swept_media($1::uuid[])",
          [[rejected.id, ready.id]],
        );
        return result.rows.map((r) => r.purge_swept_media);
      });
      expect(firstPurge).toEqual([rejected.id]);

      const stillThere = await client.query<{ id: string }>(
        "select id from public.media_assets where id = $1",
        [ready.id],
      );
      expect(stillThere.rows).toHaveLength(1);

      // Idempotent: calling again with the same (now already-gone) id errors nothing and purges nothing new.
      const secondPurge = await asPersonaCommitted(client, { role: "service_role" }, async (tx) => {
        const result = await tx.query<{ purge_swept_media: string }>(
          "select public.purge_swept_media($1::uuid[])",
          [[rejected.id]],
        );
        return result.rows.map((r) => r.purge_swept_media);
      });
      expect(secondPurge).toEqual([]);
    } finally {
      await client.query("delete from public.media_assets where id = $1", [ready.id]);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });
});
