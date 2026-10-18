import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestUser,
  deleteTestUser,
  signInTestUser,
  type TestUser,
} from "./support/auth-fixtures";
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
 * Phase 4A adversarial suite for `memories`, `media_assets`, the
 * `preallocate_media`/`finalize_memory`/`purge_rejected_media` RPCs, and
 * the batch-media Storage policies (testing.md §3.6, §3.8; security.md
 * §6.2, §7.1, §14).
 *
 * `finalize_memory` reads `storage.objects.metadata` directly rather than
 * calling the Storage API, so the SQL-level RPC tests seed that metadata
 * with a direct `pg` insert (as the migration owner, which is how every
 * other fixture in this suite seeds state) — this tests the RPC's own
 * logic, not whether a real HTTP upload happened. The Storage-authorization
 * tests below are separately proven over real HTTP with real bearer
 * tokens, per testing.md §2.4/§3.6's "called directly, not through the app."
 */

let client: Client;
let ownerA: TestUser;
let memberA: TestUser;
let strangerC: TestUser; // belongs to nothing
let memberB: TestUser; // active in a different batch

let batchAId: string;
let batchBId: string;

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

/** Seeds a pending media_assets row directly (bypassing preallocate_media's own test coverage). */
async function seedMediaAsset(
  batchId: string,
  createdBy: string,
  options: { status?: "pending" | "ready" | "rejected"; memoryId?: string | null } = {},
): Promise<{ id: string; storagePath: string }> {
  const id = crypto.randomUUID();
  const storagePath = `${batchId}/${id}`;
  const status = options.status ?? "pending";
  const mimeType = status === "ready" ? "image/jpeg" : null;
  const byteSize = status === "ready" ? 1000 : null;
  const { rows } = await client.query<{ id: string; storage_path: string }>(
    `insert into public.media_assets (id, batch_id, kind, status, storage_bucket, storage_path, created_by, memory_id, mime_type, byte_size)
     values ($1, $2, 'image', $3::public.media_status, 'batch-media', $4, $5, $6, $7, $8)
     returning id, storage_path`,
    [id, batchId, status, storagePath, createdBy, options.memoryId ?? null, mimeType, byteSize],
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

/**
 * Supabase blocks direct SQL writes to `storage.objects` ("Direct deletion
 * from storage tables is not allowed. Use the Storage API instead.") — so
 * `finalize_memory`'s Storage-observed metadata must come from a REAL
 * object, uploaded through the Storage API with service-role authority
 * (the one legitimate test-fixture-setup use of that credential, matching
 * `seedAvatarObject`'s existing precedent). `size` is therefore the actual
 * byte length of what is uploaded, not an arbitrary claim.
 */
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
  [ownerA, memberA, strangerC, memberB] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);

  for (const user of [ownerA, memberA, strangerC, memberB]) {
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
      [user.id, `Test ${user.email}`],
    );
  }

  batchAId = await seedBatch("Media Batch A", ownerA.id);
  batchBId = await seedBatch("Media Batch B", memberB.id);
  await seedActiveMember(batchAId, memberA.id);
});

afterAll(async () => {
  await client.query("delete from public.batches where id in ($1, $2)", [batchAId, batchBId]);
  await Promise.all(
    [ownerA, memberA, strangerC, memberB].map((user) =>
      deleteTestUser(user.id).catch(() => undefined),
    ),
  );
  await client.end();
});

describe("memories / media_assets — RPC-only, no direct client DML at all", () => {
  it("an active member cannot INSERT a memory directly", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "insert into public.memories (batch_id, occurred_on) values ($1, current_date)",
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a memory author cannot UPDATE their own memory's batch_id (or anything else) — no UPDATE grant exists in Phase 4A", async () => {
    const memoryId = await seedMemory(batchAId, memberA.id);
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "update public.memories set batch_id = $1 where id = $2",
      [batchBId, memoryId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("anon cannot select memories or media_assets", async () => {
    const memories = await attempt(client, { role: "anon" }, "select * from public.memories");
    const assets = await attempt(client, { role: "anon" }, "select * from public.media_assets");
    expect(memories.ok).toBe(false);
    if (!memories.ok) expect(memories.error.code).toBe("42501");
    expect(assets.ok).toBe(false);
    if (!assets.ok) expect(assets.error.code).toBe("42501");
  });

  it("a non-member cannot see batch A's memories", async () => {
    await seedMemory(batchAId, ownerA.id);
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select * from public.memories where batch_id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });
});

describe("preallocate_media", () => {
  it("an active member can preallocate", async () => {
    const row = await asPersona(client, { role: "authenticated", userId: memberA.id }, async (tx) => {
      const result = await tx.query<{ status: string; storage_path: string }>(
        "select * from public.preallocate_media($1, $2, $3)",
        [batchAId, "image/jpeg", 1000],
      );
      return result.rows[0];
    });
    expect(row?.status).toBe("pending");
    expect(row?.storage_path).toContain(batchAId);
  });

  it("refuses a non-member", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select public.preallocate_media($1, $2, $3)",
      [batchAId, "image/jpeg", 1000],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses anon", async () => {
    const result = await attempt(client, { role: "anon" }, "select public.preallocate_media($1, $2, $3)", [
      batchAId,
      "image/jpeg",
      1000,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses a disallowed declared type (e.g. SVG)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select public.preallocate_media($1, $2, $3)",
      [batchAId, "image/svg+xml", 1000],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses a declared size over the cap", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select public.preallocate_media($1, $2, $3)",
      [batchAId, "image/jpeg", 16 * 1024 * 1024],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("finalize_memory", () => {
  it("succeeds when the Storage-observed metadata is valid: creates the memory and marks the asset ready", async () => {
    const { id: assetId, storagePath } = await seedMediaAsset(batchAId, memberA.id);
    await seedObjectMetadata("batch-media", storagePath, { mimetype: "image/jpeg", size: 2048 });

    try {
      const memory = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ id: string; caption: string | null }>(
            "select * from public.finalize_memory($1, $2, $3, $4)",
            [assetId, "A real caption", "Reunion", "2024-04-12"],
          );
          return result.rows[0];
        },
      );
      expect(memory?.caption).toBe("A real caption");

      const asset = await client.query<{ status: string; memory_id: string; byte_size: string }>(
        "select status, memory_id, byte_size from public.media_assets where id = $1",
        [assetId],
      );
      expect(asset.rows[0]?.status).toBe("ready");
      expect(asset.rows[0]?.memory_id).toBe(memory?.id);
      expect(Number(asset.rows[0]?.byte_size)).toBe(2048);
    } finally {
      await client.query("delete from public.memories where id in (select memory_id from public.media_assets where id = $1)", [assetId]);
      await client.query("delete from public.media_assets where id = $1", [assetId]);
      await deleteObjectMetadata("batch-media", storagePath);
    }
  });

  it("is idempotent: a retried call returns the SAME memory, not a second one", async () => {
    const { id: assetId, storagePath } = await seedMediaAsset(batchAId, memberA.id);
    await seedObjectMetadata("batch-media", storagePath, { mimetype: "image/jpeg", size: 2048 });

    try {
      const first = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ id: string }>(
            "select * from public.finalize_memory($1, $2, $3, $4)",
            [assetId, null, null, "2024-04-12"],
          );
          return result.rows[0]?.id;
        },
      );
      const second = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ id: string }>(
            "select * from public.finalize_memory($1, $2, $3, $4)",
            [assetId, null, null, "2024-04-12"],
          );
          return result.rows[0]?.id;
        },
      );
      expect(second).toBe(first);

      const memoryCount = await client.query<{ count: string }>(
        "select count(*)::text as count from public.memories where id = $1",
        [first],
      );
      expect(memoryCount.rows[0]?.count).toBe("1");
    } finally {
      await client.query("delete from public.memories where id in (select memory_id from public.media_assets where id = $1)", [assetId]);
      await client.query("delete from public.media_assets where id = $1", [assetId]);
      await deleteObjectMetadata("batch-media", storagePath);
    }
  });

  it("rejects an oversized object, from the ACTUAL Storage-observed size, not any client claim", async () => {
    const { id: assetId, storagePath } = await seedMediaAsset(batchAId, memberA.id);
    await seedObjectMetadata("batch-media", storagePath, {
      mimetype: "image/jpeg",
      size: 20 * 1024 * 1024,
    });

    try {
      const outcome = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ result: unknown }>(
            "select public.finalize_memory($1, $2, $3, $4) as result",
            [assetId, null, null, "2024-04-12"],
          );
          return result.rows[0]?.result;
        },
      );
      // No memory is created for a rejected upload — the function returns
      // NULL rather than raising, so the rejected write actually persists
      // (a statement that raises undoes its own prior writes).
      expect(outcome).toBeNull();

      const asset = await client.query<{ status: string }>(
        "select status from public.media_assets where id = $1",
        [assetId],
      );
      expect(asset.rows[0]?.status).toBe("rejected");
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
      await deleteObjectMetadata("batch-media", storagePath);
    }
  });

  it("rejects a disallowed Storage-observed content type", async () => {
    const { id: assetId, storagePath } = await seedMediaAsset(batchAId, memberA.id);
    await seedObjectMetadata("batch-media", storagePath, {
      mimetype: "application/pdf",
      size: 2048,
    });

    try {
      const outcome = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ result: unknown }>(
            "select public.finalize_memory($1, $2, $3, $4) as result",
            [assetId, null, null, "2024-04-12"],
          );
          return result.rows[0]?.result;
        },
      );
      expect(outcome).toBeNull();

      const asset = await client.query<{ status: string }>(
        "select status from public.media_assets where id = $1",
        [assetId],
      );
      expect(asset.rows[0]?.status).toBe("rejected");
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
      await deleteObjectMetadata("batch-media", storagePath);
    }
  });

  it("marks rejected (returns NULL, not an error) when no object exists at the issued path at all", async () => {
    const { id: assetId } = await seedMediaAsset(batchAId, memberA.id);
    try {
      const outcome = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: memberA.id },
        async (tx) => {
          const result = await tx.query<{ result: unknown }>(
            "select public.finalize_memory($1, $2, $3, $4) as result",
            [assetId, null, null, "2024-04-12"],
          );
          return result.rows[0]?.result;
        },
      );
      expect(outcome).toBeNull();

      const asset = await client.query<{ status: string }>(
        "select status from public.media_assets where id = $1",
        [assetId],
      );
      expect(asset.rows[0]?.status).toBe("rejected");
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
    }
  });

  it("refuses a caller who does not own the pending asset", async () => {
    const { id: assetId, storagePath } = await seedMediaAsset(batchAId, memberA.id);
    try {
      const result = await attempt(
        client,
        { role: "authenticated", userId: ownerA.id },
        "select public.finalize_memory($1, $2, $3, $4)",
        [assetId, null, null, "2024-04-12"],
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("42501");
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
      await deleteObjectMetadata("batch-media", storagePath);
    }
  });

  it("refuses anon", async () => {
    const result = await attempt(client, { role: "anon" }, "select public.finalize_memory($1, $2, $3, $4)", [
      "00000000-0000-0000-0000-000000000000",
      null,
      null,
      "2024-04-12",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("media_assets — read visibility (SQL level, as a cross-check of the HTTP-level Storage tests below)", () => {
  it("a ready asset is visible to an active member of its batch", async () => {
    const memoryId = await seedMemory(batchAId, ownerA.id);
    const { id: assetId } = await seedMediaAsset(batchAId, ownerA.id, {
      status: "ready",
      memoryId,
    });
    try {
      const result = await attempt<{ id: string }>(
        client,
        { role: "authenticated", userId: memberA.id },
        "select id from public.media_assets where id = $1",
        [assetId],
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.rows).toHaveLength(1);
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("a ready asset is NOT visible to a non-member", async () => {
    const memoryId = await seedMemory(batchAId, ownerA.id);
    const { id: assetId } = await seedMediaAsset(batchAId, ownerA.id, {
      status: "ready",
      memoryId,
    });
    try {
      const result = await attempt(
        client,
        { role: "authenticated", userId: strangerC.id },
        "select id from public.media_assets where id = $1",
        [assetId],
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.rows).toEqual([]);
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("a PENDING asset is visible only to its own uploader — not another active member of the same batch", async () => {
    const { id: assetId } = await seedMediaAsset(batchAId, memberA.id, { status: "pending" });
    try {
      const own = await attempt<{ id: string }>(
        client,
        { role: "authenticated", userId: memberA.id },
        "select id from public.media_assets where id = $1",
        [assetId],
      );
      expect(own.ok).toBe(true);
      if (own.ok) expect(own.rows).toHaveLength(1);

      const other = await attempt(
        client,
        { role: "authenticated", userId: ownerA.id },
        "select id from public.media_assets where id = $1",
        [assetId],
      );
      expect(other.ok).toBe(true);
      if (other.ok) expect(other.rows).toEqual([]);
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
    }
  });

  it("a REJECTED asset is never generally readable, even by its own uploader", async () => {
    const { id: assetId } = await seedMediaAsset(batchAId, memberA.id, { status: "rejected" });
    try {
      const result = await attempt(
        client,
        { role: "authenticated", userId: memberA.id },
        "select id from public.media_assets where id = $1",
        [assetId],
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.rows).toEqual([]);
    } finally {
      await client.query("delete from public.media_assets where id = $1", [assetId]);
    }
  });
});

describe("batch-media Storage authorization (HTTP, direct — security.md §6.2, §7.1)", () => {
  function objectUrl(path: string): string {
    return `${supabaseApiUrl()}/storage/v1/object/batch-media/${path}`;
  }

  async function getObject(bearer: string | null, path: string): Promise<Response> {
    return fetch(objectUrl(path), {
      headers: {
        apikey: supabaseAnonKey(),
        ...(bearer !== null ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    });
  }

  async function putObject(bearer: string, path: string): Promise<Response> {
    return fetch(objectUrl(path), {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array([1, 2, 3, 4]),
    });
  }

  async function seedRealObject(path: string): Promise<void> {
    const response = await fetch(objectUrl(path), {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${supabaseServiceRoleKey()}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array([1, 2, 3, 4]),
    });
    if (!response.ok) {
      throw new Error(`failed to seed real Storage object at ${path}: ${response.status}`);
    }
  }

  async function removeRealObject(path: string): Promise<void> {
    await fetch(objectUrl(path), {
      method: "DELETE",
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${supabaseServiceRoleKey()}`,
      },
    }).catch(() => undefined);
  }

  let ownerToken: string;
  let memberToken: string;
  let strangerToken: string;
  let memberBToken: string;

  beforeAll(async () => {
    [ownerToken, memberToken, strangerToken, memberBToken] = await Promise.all([
      signInTestUser(ownerA),
      signInTestUser(memberA),
      signInTestUser(strangerC),
      signInTestUser(memberB),
    ]);
  });

  it("a ready object is readable by an active member of its batch", async () => {
    const memoryId = await seedMemory(batchAId, ownerA.id);
    const { storagePath } = await seedMediaAsset(batchAId, ownerA.id, { status: "ready", memoryId });
    await seedRealObject(storagePath);
    try {
      const response = await getObject(memberToken, storagePath);
      expect(response.status).toBe(200);
    } finally {
      await removeRealObject(storagePath);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("a ready object is refused for a non-member", async () => {
    const memoryId = await seedMemory(batchAId, ownerA.id);
    const { storagePath } = await seedMediaAsset(batchAId, ownerA.id, { status: "ready", memoryId });
    await seedRealObject(storagePath);
    try {
      const response = await getObject(strangerToken, storagePath);
      expect(response.status).not.toBe(200);
    } finally {
      await removeRealObject(storagePath);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("a ready object is refused for a member of a DIFFERENT batch", async () => {
    const memoryId = await seedMemory(batchAId, ownerA.id);
    const { storagePath } = await seedMediaAsset(batchAId, ownerA.id, { status: "ready", memoryId });
    await seedRealObject(storagePath);
    try {
      const response = await getObject(memberBToken, storagePath);
      expect(response.status).not.toBe(200);
    } finally {
      await removeRealObject(storagePath);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("refuses an unauthenticated read", async () => {
    const memoryId = await seedMemory(batchAId, ownerA.id);
    const { storagePath } = await seedMediaAsset(batchAId, ownerA.id, { status: "ready", memoryId });
    await seedRealObject(storagePath);
    try {
      const response = await getObject(null, storagePath);
      expect(response.status).not.toBe(200);
    } finally {
      await removeRealObject(storagePath);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("a pending object is readable by its own uploader only", async () => {
    const { storagePath } = await seedMediaAsset(batchAId, memberA.id, { status: "pending" });
    await seedRealObject(storagePath);
    try {
      const own = await getObject(memberToken, storagePath);
      expect(own.status).toBe(200);

      const other = await getObject(ownerToken, storagePath);
      expect(other.status).not.toBe(200);
    } finally {
      await removeRealObject(storagePath);
    }
  });

  it("a rejected object is never generally readable", async () => {
    const { storagePath } = await seedMediaAsset(batchAId, memberA.id, { status: "rejected" });
    await seedRealObject(storagePath);
    try {
      const response = await getObject(memberToken, storagePath);
      expect(response.status).not.toBe(200);
    } finally {
      await removeRealObject(storagePath);
    }
  });

  it("refuses an upload to a path with no matching pending row at all", async () => {
    const path = `${batchAId}/${crypto.randomUUID()}`;
    const response = await putObject(memberToken, path);
    expect(response.status).not.toBe(200);
  });

  it("refuses a member uploading to ANOTHER member's pending media id", async () => {
    const { storagePath } = await seedMediaAsset(batchAId, memberA.id, { status: "pending" });
    try {
      const response = await putObject(ownerToken, storagePath);
      expect(response.status).not.toBe(200);
    } finally {
      await removeRealObject(storagePath).catch(() => undefined);
    }
  });

  it("refuses overwriting an existing READY object through the ordinary upload path", async () => {
    const memoryId = await seedMemory(batchAId, memberA.id);
    const { storagePath } = await seedMediaAsset(batchAId, memberA.id, {
      status: "ready",
      memoryId,
    });
    await seedRealObject(storagePath);
    try {
      const response = await putObject(memberToken, storagePath);
      expect(response.status).not.toBe(200);
    } finally {
      await removeRealObject(storagePath);
      await client.query("delete from public.memories where id = $1", [memoryId]);
    }
  });

  it("an ordinary member cannot delete a Storage object directly — no delete policy exists for any client role", async () => {
    const { storagePath } = await seedMediaAsset(batchAId, memberA.id, { status: "pending" });
    await seedRealObject(storagePath);
    try {
      const response = await fetch(objectUrl(storagePath), {
        method: "DELETE",
        headers: { apikey: supabaseAnonKey(), Authorization: `Bearer ${memberToken}` },
      });
      expect(response.ok).toBe(false);

      // The object must still exist afterward.
      const stillThere = await getObject(memberToken, storagePath);
      expect(stillThere.status).toBe(200);
    } finally {
      await removeRealObject(storagePath);
    }
  });
});
