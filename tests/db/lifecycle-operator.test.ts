import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteTestUser, type TestUser } from "./support/auth-fixtures";
import { asPersona, attempt, connect, type Persona } from "./support/db";

/**
 * Focused adversarial suite for Phase 8B (batch/account lifecycle) and the
 * Phase 9 B4 operator minimum. Not a re-run of any earlier phase's suite.
 * Every state change runs inside a rolled-back transaction unless the test
 * says otherwise.
 */

let client: Client;
let owner: TestUser;
let admin: TestUser;
let member: TestUser;

let batchId: string;
let memoryId: string;

const BATCH_NAME = "Lifecycle Batch";

async function seedBatch(name: string, ownerId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.batches (name, institution_name, created_by)
     values ($1, 'Test University', $2) returning id`,
    [name, ownerId],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("failed to seed batch fixture");
  await seedMember(id, ownerId, "owner");
  return id;
}

async function seedMember(id: string, profileId: string, role: string): Promise<void> {
  await client.query(
    `insert into public.batch_members (batch_id, profile_id, role, status, joined_at, decided_at, decided_by)
     values ($1, $2, $3::public.batch_role, 'active', now(), now(), $2)`,
    [id, profileId, role],
  );
}

async function seedMemory(id: string, createdBy: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.memories (batch_id, created_by, occurred_on) values ($1, $2, current_date) returning id`,
    [id, createdBy],
  );
  const memory = rows[0]?.id;
  if (memory === undefined) throw new Error("failed to seed memory fixture");
  return memory;
}

/**
 * Like asPersona, but lets the test first run setup as the connection's own
 * (owner) role in the same rolled-back transaction — e.g. back-dating a
 * deletion past the 30-day window.
 */
async function withSetup<T>(
  setup: string[],
  persona: Persona,
  work: (tx: Client) => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    for (const statement of setup) {
      await client.query(statement);
    }
    const claims =
      persona.userId === undefined
        ? JSON.stringify({ role: persona.role })
        : JSON.stringify({ sub: persona.userId, role: persona.role });
    await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await client.query(`set local role ${persona.role}`);
    return await work(client);
  } finally {
    await client.query("rollback");
  }
}

async function errorOf(tx: Client, sql: string, params: unknown[] = []): Promise<string | null> {
  await tx.query("savepoint probe");
  try {
    await tx.query(sql, params);
    await tx.query("release savepoint probe");
    return null;
  } catch (error) {
    await tx.query("rollback to savepoint probe");
    return (error as { code?: string }).code ?? "unknown";
  }
}

beforeAll(async () => {
  client = await connect();
  [owner, admin, member] = await Promise.all([createTestUser(), createTestUser(), createTestUser()]);
  for (const user of [owner, admin, member]) {
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
      [user.id, `Test ${user.email}`],
    );
  }
  batchId = await seedBatch(BATCH_NAME, owner.id);
  await seedMember(batchId, admin.id, "admin");
  await seedMember(batchId, member.id, "member");
  memoryId = await seedMemory(batchId, member.id);
});

afterAll(async () => {
  await client.query("delete from public.batches where id = $1", [batchId]);
  await Promise.all(
    [owner, admin, member].map((user) => deleteTestUser(user.id).catch(() => undefined)),
  );
  await client.end();
});

describe("delete_batch", () => {
  it("refuses an admin (owner-only)", async () => {
    const result = await attempt(client, { role: "authenticated", userId: admin.id },
      "select public.delete_batch($1, $2)", [batchId, BATCH_NAME]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses the owner when the typed name does not match exactly", async () => {
    const result = await attempt(client, { role: "authenticated", userId: owner.id },
      "select public.delete_batch($1, $2)", [batchId, BATCH_NAME.toLowerCase()]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("22023");
  });

  it("owner deletion makes the batch and everything in it invisible to every member", async () => {
    await asPersona(client, { role: "authenticated", userId: owner.id }, async (tx) => {
      await tx.query("select public.delete_batch($1, $2)", [batchId, BATCH_NAME]);

      await tx.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: member.id, role: "authenticated" })]);
      const role = await tx.query("select public.my_batch_role($1) as role", [batchId]);
      expect(role.rows[0]?.role).toBeNull();
      const batches = await tx.query("select id from public.batches where id = $1", [batchId]);
      expect(batches.rowCount).toBe(0);
      const memories = await tx.query("select id from public.memories where batch_id = $1", [batchId]);
      expect(memories.rowCount).toBe(0);
      const roster = await tx.query(
        "select profile_id from public.batch_members where batch_id = $1 and profile_id <> $2",
        [batchId, member.id]);
      expect(roster.rowCount).toBe(0);
      expect(await errorOf(tx,
        "insert into public.comments (batch_id, memory_id, body) values ($1, $2, 'x')",
        [batchId, memoryId])).not.toBeNull();
    });
  });

  it("the owner can restore within the window, and list_my_deleted_batches shows it", async () => {
    await asPersona(client, { role: "authenticated", userId: owner.id }, async (tx) => {
      await tx.query("select public.delete_batch($1, $2)", [batchId, BATCH_NAME]);
      const listed = await tx.query<{ id: string; restorable: boolean }>(
        "select id, restorable from public.list_my_deleted_batches()");
      expect(listed.rows).toEqual([{ id: batchId, restorable: true }]);

      await tx.query("select public.restore_batch($1)", [batchId]);
      const role = await tx.query("select public.my_batch_role($1) as role", [batchId]);
      expect(role.rows[0]?.role).toBe("owner");
    });
  });

  it("a non-owner member cannot restore, and nobody can restore after 30 days", async () => {
    await withSetup(
      [`update public.batches set deleted_at = now() - interval '1 day' where id = '${batchId}'`],
      { role: "authenticated", userId: admin.id },
      async (tx) => {
        expect(await errorOf(tx, "select public.restore_batch($1)", [batchId])).toBe("42501");
      },
    );
    await withSetup(
      [`update public.batches set deleted_at = now() - interval '31 days' where id = '${batchId}'`],
      { role: "authenticated", userId: owner.id },
      async (tx) => {
        expect(await errorOf(tx, "select public.restore_batch($1)", [batchId])).toBe("42501");
      },
    );
  });
});

describe("prepare_account_deletion", () => {
  it("blocks an active owner of a live batch", async () => {
    const result = await attempt(client, { role: "authenticated", userId: owner.id },
      "select public.prepare_account_deletion()");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("owns_active_batch");
  });

  it("allows a non-owner, and an owner whose only batch is deleted", async () => {
    const asMember = await attempt(client, { role: "authenticated", userId: member.id },
      "select public.prepare_account_deletion()");
    expect(asMember.ok).toBe(true);

    await withSetup(
      [`update public.batches set deleted_at = now() where id = '${batchId}'`],
      { role: "authenticated", userId: owner.id },
      async (tx) => {
        expect(await errorOf(tx, "select public.prepare_account_deletion()")).toBeNull();
      },
    );
  });

  it("refuses anon", async () => {
    const result = await attempt(client, { role: "anon" }, "select public.prepare_account_deletion()");
    expect(result.ok).toBe(false);
  });

  it("deleting the Auth user removes membership but keeps shared content as 'Former member'", async () => {
    const leaver = await createTestUser();
    await client.query("insert into public.profiles (id, display_name) values ($1, 'Leaver')", [leaver.id]);
    await seedMember(batchId, leaver.id, "member");
    const leaverMemory = await seedMemory(batchId, leaver.id);

    await deleteTestUser(leaver.id);

    const memory = await client.query<{ created_by: string | null }>(
      "select created_by from public.memories where id = $1", [leaverMemory]);
    expect(memory.rows).toEqual([{ created_by: null }]);
    const membership = await client.query(
      "select 1 from public.batch_members where profile_id = $1", [leaver.id]);
    expect(membership.rowCount).toBe(0);
    const profile = await client.query("select 1 from public.profiles where id = $1", [leaver.id]);
    expect(profile.rowCount).toBe(0);

    await client.query("delete from public.memories where id = $1", [leaverMemory]);
  });
});

describe("reaper functions", () => {
  const reaperCalls: [string, (id: string) => unknown[]][] = [
    ["select * from public.list_reapable_batches(10)", () => []],
    ["select * from public.list_batch_storage_objects($1, 10)", (id) => [id]],
    ["select public.purge_batch($1)", (id) => [id]],
  ];

  it("refuse authenticated and anon callers", async () => {
    for (const [sql, params] of reaperCalls) {
      for (const persona of [{ role: "authenticated", userId: owner.id }, { role: "anon" }] as Persona[]) {
        const result = await attempt(client, persona, sql, params(batchId));
        expect(result.ok, `${persona.role}: ${sql}`).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("42501");
      }
    }
  });

  it("purge_batch refuses a batch still inside its window, and purges one past it", async () => {
    await withSetup(
      [`update public.batches set deleted_at = now() - interval '29 days' where id = '${batchId}'`],
      { role: "service_role" },
      async (tx) => {
        const listed = await tx.query<{ list_reapable_batches: string }>(
          "select * from public.list_reapable_batches(50)");
        expect(listed.rows.map((r) => r.list_reapable_batches)).not.toContain(batchId);
        const purged = await tx.query<{ purge_batch: boolean }>("select public.purge_batch($1)", [batchId]);
        expect(purged.rows[0]?.purge_batch).toBe(false);
      },
    );

    await withSetup(
      [`update public.batches set deleted_at = now() - interval '31 days' where id = '${batchId}'`],
      { role: "service_role" },
      async (tx) => {
        const listed = await tx.query<{ list_reapable_batches: string }>(
          "select * from public.list_reapable_batches(50)");
        expect(listed.rows.map((r) => r.list_reapable_batches)).toContain(batchId);
        const purged = await tx.query<{ purge_batch: boolean }>("select public.purge_batch($1)", [batchId]);
        expect(purged.rows[0]?.purge_batch).toBe(true);
        await tx.query("reset role");
        const remaining = await tx.query("select 1 from public.memories where batch_id = $1", [batchId]);
        expect(remaining.rowCount).toBe(0);
      },
    );
  });

  it("purge_batch refuses while a Storage object remains under the batch prefix (object-first)", async () => {
    await withSetup(
      [
        `update public.batches set deleted_at = now() - interval '31 days' where id = '${batchId}'`,
        `insert into storage.objects (bucket_id, name) values ('batch-media', '${batchId}/orphan.jpg')`,
      ],
      { role: "service_role" },
      async (tx) => {
        const objects = await tx.query<{ name: string }>(
          "select name from public.list_batch_storage_objects($1, 10)", [batchId]);
        expect(objects.rows.map((r) => r.name)).toContain(`${batchId}/orphan.jpg`);
        const purged = await tx.query<{ purge_batch: boolean }>("select public.purge_batch($1)", [batchId]);
        expect(purged.rows[0]?.purge_batch).toBe(false);
      },
    );
  });
});

describe("operator moderation (B4)", () => {
  it("operator functions refuse authenticated and anon callers", async () => {
    for (const persona of [{ role: "authenticated", userId: owner.id }, { role: "anon" }] as Persona[]) {
      const removal = await attempt(client, persona,
        "select public.operator_remove_content('memory', $1, 'reason')", [memoryId]);
      expect(removal.ok).toBe(false);
      const takedown = await attempt(client, persona,
        "select public.operator_takedown_batch($1, 'reason')", [batchId]);
      expect(takedown.ok).toBe(false);
    }
  });

  it("requires a reason", async () => {
    const result = await attempt(client, { role: "service_role" },
      "select public.operator_remove_content('memory', $1, '  ')", [memoryId]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("22023");
  });

  it("an operator removal is audited and cannot be restored by the batch's own moderators", async () => {
    await asPersona(client, { role: "service_role" }, async (tx) => {
      await tx.query("select public.operator_remove_content('memory', $1, 'illegal content')", [memoryId]);
      await tx.query("reset role");
      const audit = await tx.query<{ actor_profile_id: string | null; detail: { operator: boolean } }>(
        `select actor_profile_id, detail from public.audit_logs
          where target_id = $1 and action = 'content_removed' order by id desc limit 1`, [memoryId]);
      expect(audit.rows[0]?.actor_profile_id).toBeNull();
      expect(audit.rows[0]?.detail.operator).toBe(true);

      await tx.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: owner.id, role: "authenticated" })]);
      await tx.query("set local role authenticated");
      expect(await errorOf(tx, "select public.restore_content('memory', $1)", [memoryId])).toBe("42501");
    });
  });

  it("a moderator removal is still restorable by the batch (Phase 8A behaviour kept)", async () => {
    await asPersona(client, { role: "authenticated", userId: owner.id }, async (tx) => {
      await tx.query("select public.remove_content('memory', $1)", [memoryId]);
      expect(await errorOf(tx, "select public.restore_content('memory', $1)", [memoryId])).toBeNull();
    });
  });

  it("an operator takedown hides the batch and the owner cannot restore it", async () => {
    await asPersona(client, { role: "service_role" }, async (tx) => {
      await tx.query("select public.operator_takedown_batch($1, 'hostile owner')", [batchId]);
      await tx.query("reset role");
      await tx.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: owner.id, role: "authenticated" })]);
      await tx.query("set local role authenticated");
      const role = await tx.query("select public.my_batch_role($1) as role", [batchId]);
      expect(role.rows[0]?.role).toBeNull();
      const listed = await tx.query<{ restorable: boolean }>(
        "select restorable from public.list_my_deleted_batches() where id = $1", [batchId]);
      expect(listed.rows).toEqual([{ restorable: false }]);
      expect(await errorOf(tx, "select public.restore_batch($1)", [batchId])).toBe("42501");
    });
  });
});
