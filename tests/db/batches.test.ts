import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestUser,
  deleteAvatarObject,
  deleteTestUser,
  seedAvatarObject,
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
} from "./support/db";

/**
 * Phase 2 adversarial suite for `batches`, `batch_members`, `audit_logs`,
 * the `my_batch_role` membership predicate, and the two privileged RPCs
 * (testing.md §3.1; security.md §5.2.1, §5.3, §5.4, §5.6, §11, §20).
 *
 * Called directly against the database, impersonating each persona
 * (testing.md §2.3) — this tests the boundary, not the application.
 *
 * Fixtures below are seeded with a direct, unwrapped `client.query()` call
 * (running as the connection's own role, `postgres`, which bypasses RLS as
 * this project's BYPASSRLS-holding owner — security.md §32 B2) exactly the
 * way `profiles.test.ts` seeded a committed profile row: real, committed
 * rows that persist across the separately-rolled-back `attempt()`
 * transactions used for the actual negative/positive assertions.
 */

let client: Client;

let ownerA: TestUser; // owner of batchA; also seeded as a plain member of batchB (multi-batch case)
let memberA: TestUser; // active member of batchA only
let strangerC: TestUser; // belongs to neither batch
let pendingD: TestUser; // seeded PENDING in batchA — simulates a future invite-redemption state
let ownerB: TestUser; // owner of batchB

let batchAId: string;
let batchBId: string;

async function seedBatch(name: string, ownerId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.batches (name, institution_name, created_by)
     values ($1, 'Test University', $2)
     returning id`,
    [name, ownerId],
  );
  const batchId = rows[0]?.id;
  if (batchId === undefined) {
    throw new Error("failed to seed batch fixture");
  }
  await client.query(
    `insert into public.batch_members (batch_id, profile_id, role, status, joined_at, decided_at, decided_by)
     values ($1, $2, 'owner', 'active', now(), now(), $2)`,
    [batchId, ownerId],
  );
  return batchId;
}

async function seedMember(
  batchId: string,
  profileId: string,
  role: "member" | "moderator" | "admin",
  status: "active" | "pending",
): Promise<void> {
  if (status === "active") {
    await client.query(
      `insert into public.batch_members (batch_id, profile_id, role, status, joined_at, decided_at, decided_by)
       values ($1, $2, $3, 'active', now(), now(), $2)`,
      [batchId, profileId, role],
    );
  } else {
    await client.query(
      `insert into public.batch_members (batch_id, profile_id, role, status)
       values ($1, $2, $3, 'pending')`,
      [batchId, profileId, role],
    );
  }
}

beforeAll(async () => {
  client = await connect();
  [ownerA, memberA, strangerC, pendingD, ownerB] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);

  // A real profiles row per test user: batches.created_by has a real FK to
  // profiles, and the shared-batch-visibility tests below need a real
  // display_name to read (mirrors profiles.test.ts's seeding pattern).
  // Sequential, not Promise.all: a single `pg.Client` connection cannot run
  // concurrent queries.
  for (const user of [ownerA, memberA, strangerC, pendingD, ownerB]) {
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
      [user.id, `Test ${user.email}`],
    );
  }

  batchAId = await seedBatch("Batch A", ownerA.id);
  batchBId = await seedBatch("Batch B", ownerB.id);

  await seedMember(batchAId, memberA.id, "member", "active");
  await seedMember(batchAId, pendingD.id, "member", "pending");
  // ownerA is ALSO a plain member of batchB — the multi-batch case.
  await seedMember(batchBId, ownerA.id, "member", "active");
});

afterAll(async () => {
  // Cascades: batches -> batch_members (ON DELETE CASCADE).
  await client.query("delete from public.batches where id in ($1, $2)", [
    batchAId,
    batchBId,
  ]);
  await Promise.all(
    [ownerA, memberA, strangerC, pendingD, ownerB].map((user) =>
      deleteTestUser(user.id).catch(() => undefined),
    ),
  );
  await client.end();
});

describe("batches / batch_members — unauthenticated and non-member access", () => {
  it("anon cannot select batches — no SELECT grant at all, not merely an empty RLS result", async () => {
    const result = await attempt(client, { role: "anon" }, "select * from public.batches");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("anon cannot select memberships — same reason", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      "select * from public.batch_members",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("anon cannot insert a batch", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      "insert into public.batches (name, institution_name) values ('nope', 'nope')",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a non-member (stranger) sees nothing for a batch they are not in", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select * from public.batches where id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });

  it("a non-member sees no membership rows for a batch they are not in", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select * from public.batch_members where batch_id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });
});

describe("batch_members — the single most important negative test", () => {
  it("a caller can NEVER create their own membership row by supplying a batch id", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      `insert into public.batch_members (batch_id, profile_id, role, status)
       values ($1, $2, 'owner', 'active')`,
      [batchAId, strangerC.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Refused at the privilege level (no INSERT grant at all) — not merely
      // by a policy (security.md §5.2, §5.6).
      expect(result.error.code).toBe("42501");
    }
  });
});

describe("batches / batch_members — every write is RPC-only", () => {
  it("an active member cannot UPDATE the batch directly", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "update public.batches set name = 'forged' where id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an owner cannot UPDATE the batch directly either — RPC-only means everyone", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "update public.batches set name = 'forged' where id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a member cannot promote themselves to owner via direct UPDATE", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "update public.batch_members set role = 'owner' where batch_id = $1 and profile_id = $2",
      [batchAId, memberA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("no one can DELETE a batch directly", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "delete from public.batches where id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("no one can DELETE a membership row directly", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "delete from public.batch_members where batch_id = $1 and profile_id = $2",
      [batchAId, memberA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("batch_members — roster visibility rules", () => {
  it("an active member sees the FULL roster, including a pending row", async () => {
    const result = await attempt<{ profile_id: string; status: string }>(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select profile_id, status from public.batch_members where batch_id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.rows.map((row) => row.profile_id);
    expect(ids).toContain(ownerA.id);
    expect(ids).toContain(memberA.id);
    expect(ids).toContain(pendingD.id);
    expect(result.rows).toHaveLength(3);
  });

  it("a PENDING requester sees ONLY their own row — not the roster", async () => {
    const result = await attempt<{ profile_id: string }>(
      client,
      { role: "authenticated", userId: pendingD.id },
      "select profile_id from public.batch_members where batch_id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((row) => row.profile_id)).toEqual([pendingD.id]);
  });

  it("a PENDING requester cannot see the batch itself — zero access", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: pendingD.id },
      "select * from public.batches where id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });
});

describe("cross-batch isolation", () => {
  it("a member of batch A cannot see batch B", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select * from public.batches where id = $1",
      [batchBId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });

  it("a member of batch A cannot see batch B's membership rows", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      "select * from public.batch_members where batch_id = $1",
      [batchBId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });

  it("a user in TWO batches sees exactly those two, and no more", async () => {
    const result = await attempt<{ id: string }>(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select id from public.batches order by id",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.rows.map((row) => row.id).sort();
    expect(ids).toEqual([batchAId, batchBId].sort());
  });
});

describe("my_batch_role — the membership predicate", () => {
  it("returns the caller's real role when they are an active member", async () => {
    const owner = await attempt<{ role: string | null }>(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select public.my_batch_role($1) as role",
      [batchAId],
    );
    expect(owner.ok).toBe(true);
    if (owner.ok) expect(owner.rows[0]?.role).toBe("owner");

    const member = await attempt<{ role: string | null }>(
      client,
      { role: "authenticated", userId: memberA.id },
      "select public.my_batch_role($1) as role",
      [batchAId],
    );
    expect(member.ok).toBe(true);
    if (member.ok) expect(member.rows[0]?.role).toBe("member");
  });

  it("is not an oracle: a stranger gets the identical NULL for a real batch and a nonexistent one", async () => {
    const real = await attempt<{ role: string | null }>(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select public.my_batch_role($1) as role",
      [batchAId],
    );
    const fake = await attempt<{ role: string | null }>(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select public.my_batch_role($1) as role",
      ["00000000-0000-0000-0000-000000000000"],
    );
    expect(real.ok && real.rows[0]?.role).toBeNull();
    expect(fake.ok && fake.rows[0]?.role).toBeNull();
  });

  it("returns NULL, not a row, for a pending (not yet active) membership", async () => {
    const result = await attempt<{ role: string | null }>(
      client,
      { role: "authenticated", userId: pendingD.id },
      "select public.my_batch_role($1) as role",
      [batchAId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows[0]?.role).toBeNull();
  });

  it("refuses anon — EXECUTE was never granted", async () => {
    const result = await attempt(client, { role: "anon" }, "select public.my_batch_role($1)", [
      batchAId,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("create_batch — atomic batch + owner bootstrap (security.md §5.2.1)", () => {
  it("creates the batch AND the caller's owner membership in one call", async () => {
    const { batch, roster } = await asPersona(
      client,
      { role: "authenticated", userId: strangerC.id },
      async (tx) => {
        const created = await tx.query<{ id: string; name: string }>(
          "select * from public.create_batch($1, $2)",
          ["Rolled-back Batch", "Rolled-back University"],
        );
        const rosterRow = await tx.query<{ role: string; status: string }>(
          "select role, status from public.batch_members where batch_id = $1 and profile_id = $2",
          [created.rows[0]?.id, strangerC.id],
        );
        return { batch: created.rows[0], roster: rosterRow.rows[0] };
      },
    );

    expect(batch?.name).toBe("Rolled-back Batch");
    expect(roster?.role).toBe("owner");
    expect(roster?.status).toBe("active");
    // Rolled back by asPersona — nothing persists past this test.
  });

  it("refuses an anonymous caller", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      "select public.create_batch($1, $2)",
      ["nope", "nope"],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("does NOT write an audit_logs row for plain batch creation", async () => {
    let createdId: string | undefined;
    try {
      createdId = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: strangerC.id },
        async (tx) => {
          const created = await tx.query<{ id: string }>(
            "select * from public.create_batch($1, $2)",
            ["Audit-check Batch", "Audit-check University"],
          );
          return created.rows[0]?.id;
        },
      );

      const auditRows = await client.query<{ count: string }>(
        "select count(*)::text as count from public.audit_logs where target_id = $1",
        [createdId],
      );
      expect(Number(auditRows.rows[0]?.count)).toBe(0);
    } finally {
      if (createdId !== undefined) {
        await client.query("delete from public.batches where id = $1", [createdId]);
      }
    }
  });
});

describe("update_batch_settings — admin+ only, audited (security.md §11, §20)", () => {
  it("an admin+ (the owner) can change settings", async () => {
    const result = await asPersona(
      client,
      { role: "authenticated", userId: ownerA.id },
      async (tx) => {
        const updated = await tx.query<{ name: string; join_policy: string }>(
          `select * from public.update_batch_settings(
             $1, 'Batch A (renamed)', 'Test University', null, null, null, null, null,
             'invite_only_auto_approve'
           )`,
          [batchAId],
        );
        return updated.rows[0];
      },
    );
    expect(result?.name).toBe("Batch A (renamed)");
    expect(result?.join_policy).toBe("invite_only_auto_approve");
    // Rolled back — batchA's real name is untouched for later tests.
  });

  it("a plain member (below admin) is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberA.id },
      `select public.update_batch_settings(
         $1, 'forged', 'forged', null, null, null, null, null, 'invite_only_auto_approve'
       )`,
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a non-member is refused — same shape as 'not admin' (indistinguishable denial)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      `select public.update_batch_settings(
         $1, 'forged', 'forged', null, null, null, null, null, 'invite_only_auto_approve'
       )`,
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an owner of a DIFFERENT batch cannot touch this one", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerB.id },
      `select public.update_batch_settings(
         $1, 'forged', 'forged', null, null, null, null, null, 'invite_only_auto_approve'
       )`,
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses anon", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      `select public.update_batch_settings(
         $1, 'forged', 'forged', null, null, null, null, null, 'invite_only_auto_approve'
       )`,
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("writes exactly one audit_logs row recording the actor, action, and before/after settings", async () => {
    await asPersonaCommitted(client, { role: "authenticated", userId: ownerB.id }, async (tx) => {
      await tx.query(
        `select public.update_batch_settings(
           $1, 'Batch B (audited change)', 'Test University', null, null, null, null, null,
           'invite_only_requires_approval'
         )`,
        [batchBId],
      );
    });

    try {
      const rows = await client.query<{
        action: string;
        actor_profile_id: string;
        actor_role: string;
        target_kind: string;
        target_id: string;
        detail: { before: { name: string }; after: { name: string } };
      }>(
        `select action, actor_profile_id, actor_role, target_kind, target_id, detail
           from public.audit_logs
          where batch_id = $1 and action = 'batch_settings_changed'`,
        [batchBId],
      );

      expect(rows.rows).toHaveLength(1);
      const row = rows.rows[0];
      expect(row?.actor_profile_id).toBe(ownerB.id);
      expect(row?.actor_role).toBe("owner");
      expect(row?.target_kind).toBe("batch");
      expect(row?.target_id).toBe(batchBId);
      expect(row?.detail.before.name).toBe("Batch B");
      expect(row?.detail.after.name).toBe("Batch B (audited change)");
    } finally {
      // Restore the fixture's real name for any later test in this file,
      // and remove the audit row this test itself produced.
      await client.query("update public.batches set name = 'Batch B' where id = $1", [
        batchBId,
      ]);
      await client.query(
        "delete from public.audit_logs where batch_id = $1 and action = 'batch_settings_changed'",
        [batchBId],
      );
    }
  });
});

describe("audit_logs — no direct client access at all (security.md §3.10, §5.4)", () => {
  it("refuses anon SELECT", async () => {
    const result = await attempt(client, { role: "anon" }, "select * from public.audit_logs");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses an authenticated admin+ SELECT — read access is Phase 8A scope, not built yet", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select * from public.audit_logs where batch_id = $1",
      [batchAId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses INSERT/UPDATE/DELETE by any client role", async () => {
    const insert = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "insert into public.audit_logs (action) values ('batch_settings_changed')",
    );
    const update = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "update public.audit_logs set action = 'batch_deleted'",
    );
    const del = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "delete from public.audit_logs",
    );
    expect(insert.ok).toBe(false);
    expect(update.ok).toBe(false);
    expect(del.ok).toBe(false);
  });
});

describe("profiles — shared-active-batch visibility (Phase 2 addition, security.md §5.4)", () => {
  it("a co-member (shares batch A) can read the other member's profile", async () => {
    const result = await attempt<{ id: string; display_name: string }>(
      client,
      { role: "authenticated", userId: memberA.id },
      "select id, display_name from public.profiles where id = $1",
      [ownerA.id],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toHaveLength(1);
  });

  it("a non-co-member (no shared batch) cannot read the profile", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select id from public.profiles where id = $1",
      [ownerA.id],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });

  it("a PENDING member (not yet active) still cannot read others' profiles", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: pendingD.id },
      "select id from public.profiles where id = $1",
      [ownerA.id],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });
});

describe("avatars Storage — shared-active-batch visibility (HTTP, direct)", () => {
  const AVATAR_PATH = () => `${ownerA.id}/phase2-shared-batch-avatar`;

  beforeAll(async () => {
    await seedAvatarObject(AVATAR_PATH());
  });

  afterAll(async () => {
    await deleteAvatarObject(AVATAR_PATH()).catch(() => undefined);
  });

  function objectUrl(path: string): string {
    return `${supabaseApiUrl()}/storage/v1/object/avatars/${path}`;
  }

  it("a co-member CAN read another member's avatar object", async () => {
    const token = await signInTestUser(memberA);
    const response = await fetch(objectUrl(AVATAR_PATH()), {
      headers: { apikey: supabaseAnonKey(), Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
  });

  it("a non-co-member (stranger) cannot read the avatar object", async () => {
    const token = await signInTestUser(strangerC);
    const response = await fetch(objectUrl(AVATAR_PATH()), {
      headers: { apikey: supabaseAnonKey(), Authorization: `Bearer ${token}` },
    });
    expect(response.status).not.toBe(200);
  });
});
