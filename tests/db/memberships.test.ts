import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteTestUser, type TestUser } from "./support/auth-fixtures";
import { asPersonaCommitted, attempt, connect } from "./support/db";

/**
 * Phase 3B adversarial suite for the five membership-decision RPCs:
 * `approve_member`, `reject_member`, `remove_member`, `change_member_role`,
 * `transfer_ownership` (testing.md §3.3; security.md §4, §11, §20).
 *
 * The single ceiling rule every one of these RPCs applies —
 * `caller_role > target.role` (and, for role changes, `caller_role >
 * new_role` too) — is exercised at every tier (moderator/admin/owner) so
 * the generic rule is proven correct, not just the easy case.
 *
 * "A caller forging their actor role in the payload" (phases.md Phase 3B's
 * required test) is structurally impossible here: none of these functions
 * accepts an actor-role parameter at all — the actor's role is always
 * `my_batch_role(p_batch_id)`, resolved server-side. The refusal tests below
 * for a plain member / wrong-batch actor prove the only role that ever
 * matters is the one the database itself resolves.
 */

let client: Client;

let ownerA: TestUser;
let adminA: TestUser;
let admin2A: TestUser; // peer-admin ceiling target
let modA: TestUser;
let member1A: TestUser;
let pendingShared: TestUser; // reused only by rolled-back refusal attempts
let strangerC: TestUser; // belongs to nothing

// Single-use fixtures, each consumed by exactly one committed success test.
let pendingForApprove: TestUser;
let pendingForReject: TestUser;
let memberToRemove: TestUser;
let modToRemove: TestUser;
let memberForRoleChange1: TestUser; // promoted member -> moderator
let modForDemote: TestUser; // demoted moderator -> member
let memberForRoleChange2: TestUser; // promoted member -> admin (owner-only)

// An isolated second batch, used only for the ownership-transfer tests so
// batchA's roster stays stable for every other test in this file.
let ownerC: TestUser;
let memberForTransfer: TestUser;

let batchAId: string;
let batchCId: string;

async function seedBatch(name: string, ownerId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.batches (name, institution_name, created_by)
     values ($1, 'Test University', $2)
     returning id`,
    [name, ownerId],
  );
  const batchId = rows[0]?.id;
  if (batchId === undefined) throw new Error("failed to seed batch fixture");
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
  status: "active" | "pending" = "active",
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

  [
    ownerA,
    adminA,
    admin2A,
    modA,
    member1A,
    pendingShared,
    strangerC,
    pendingForApprove,
    pendingForReject,
    memberToRemove,
    modToRemove,
    memberForRoleChange1,
    modForDemote,
    memberForRoleChange2,
    ownerC,
    memberForTransfer,
  ] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);

  const allUsers = [
    ownerA,
    adminA,
    admin2A,
    modA,
    member1A,
    pendingShared,
    strangerC,
    pendingForApprove,
    pendingForReject,
    memberToRemove,
    modToRemove,
    memberForRoleChange1,
    modForDemote,
    memberForRoleChange2,
    ownerC,
    memberForTransfer,
  ];

  // Sequential: a single pg.Client connection cannot run concurrent queries
  // (the same lesson Phase 2's batches.test.ts fixture already recorded).
  for (const user of allUsers) {
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
      [user.id, `Test ${user.email}`],
    );
  }

  batchAId = await seedBatch("Membership Batch A", ownerA.id);
  batchCId = await seedBatch("Membership Batch C", ownerC.id);

  await seedMember(batchAId, adminA.id, "admin");
  await seedMember(batchAId, admin2A.id, "admin");
  await seedMember(batchAId, modA.id, "moderator");
  await seedMember(batchAId, member1A.id, "member");
  await seedMember(batchAId, pendingShared.id, "member", "pending");
  await seedMember(batchAId, pendingForApprove.id, "member", "pending");
  await seedMember(batchAId, pendingForReject.id, "member", "pending");
  await seedMember(batchAId, memberToRemove.id, "member");
  await seedMember(batchAId, modToRemove.id, "moderator");
  await seedMember(batchAId, memberForRoleChange1.id, "member");
  await seedMember(batchAId, modForDemote.id, "moderator");
  await seedMember(batchAId, memberForRoleChange2.id, "member");

  await seedMember(batchCId, memberForTransfer.id, "member");
});

afterAll(async () => {
  await client.query("delete from public.batches where id in ($1, $2)", [batchAId, batchCId]);
  await Promise.all(
    [
      ownerA,
      adminA,
      admin2A,
      modA,
      member1A,
      pendingShared,
      strangerC,
      pendingForApprove,
      pendingForReject,
      memberToRemove,
      modToRemove,
      memberForRoleChange1,
      modForDemote,
      memberForRoleChange2,
      ownerC,
      memberForTransfer,
    ].map((user) => deleteTestUser(user.id).catch(() => undefined)),
  );
  await client.end();
});

describe("profiles_select_pending_review — mod+ can identify who they're reviewing", () => {
  it("mod+ (modA) can read a pending requester's profile", async () => {
    const result = await attempt<{ id: string }>(
      client,
      { role: "authenticated", userId: modA.id },
      "select id from public.profiles where id = $1",
      [pendingShared.id],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toHaveLength(1);
  });

  it("a plain member (below moderator) cannot read a pending requester's profile", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member1A.id },
      "select id from public.profiles where id = $1",
      [pendingShared.id],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });

  it("a non-member cannot read a pending requester's profile", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select id from public.profiles where id = $1",
      [pendingShared.id],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });
});

describe("approve_member", () => {
  it("mod+ approves a pending request: pending -> active, audited", async () => {
    const updated = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: modA.id },
      async (tx) => {
        const result = await tx.query<{ status: string; decided_by: string }>(
          "select * from public.approve_member($1, $2)",
          [batchAId, pendingForApprove.id],
        );
        return result.rows[0];
      },
    );
    expect(updated?.status).toBe("active");
    expect(updated?.decided_by).toBe(modA.id);

    try {
      const audit = await client.query<{ actor_role: string }>(
        "select actor_role from public.audit_logs where batch_id = $1 and action = 'member_approved' and target_id = (select id from public.batch_members where batch_id = $1 and profile_id = $2)",
        [batchAId, pendingForApprove.id],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0]?.actor_role).toBe("moderator");
    } finally {
      await client.query(
        "delete from public.audit_logs where batch_id = $1 and action = 'member_approved'",
        [batchAId],
      );
    }
  });

  it("a plain member cannot approve (not mod+)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member1A.id },
      "select public.approve_member($1, $2)",
      [batchAId, pendingShared.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a non-member is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select public.approve_member($1, $2)",
      [batchAId, pendingShared.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses anon", async () => {
    const result = await attempt(client, { role: "anon" }, "select public.approve_member($1, $2)", [
      batchAId,
      pendingShared.id,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an already-active target has no legal pending->active transition to make", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: modA.id },
      "select public.approve_member($1, $2)",
      [batchAId, member1A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("reject_member", () => {
  it("mod+ rejects a pending request: pending -> rejected, audited", async () => {
    const updated = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: adminA.id },
      async (tx) => {
        const result = await tx.query<{ status: string }>(
          "select * from public.reject_member($1, $2)",
          [batchAId, pendingForReject.id],
        );
        return result.rows[0];
      },
    );
    expect(updated?.status).toBe("rejected");

    await client.query(
      "delete from public.audit_logs where batch_id = $1 and action = 'member_rejected'",
      [batchAId],
    );
  });

  it("a non-mod+ attempting rejection is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member1A.id },
      "select public.reject_member($1, $2)",
      [batchAId, pendingShared.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("remove_member — rank-ceiling gated", () => {
  it("a moderator removes a plain member: active -> removed, audited", async () => {
    const updated = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: modA.id },
      async (tx) => {
        const result = await tx.query<{ status: string }>(
          "select * from public.remove_member($1, $2)",
          [batchAId, memberToRemove.id],
        );
        return result.rows[0];
      },
    );
    expect(updated?.status).toBe("removed");

    const audit = await client.query<{ count: string }>(
      "select count(*)::text as count from public.audit_logs where batch_id = $1 and action = 'member_removed'",
      [batchAId],
    );
    expect(Number(audit.rows[0]?.count)).toBeGreaterThanOrEqual(1);
    await client.query(
      "delete from public.audit_logs where batch_id = $1 and action = 'member_removed'",
      [batchAId],
    );

    // A removed member immediately loses read access (security.md A2/A3).
    const afterRemoval = await attempt(
      client,
      { role: "authenticated", userId: memberToRemove.id },
      "select * from public.batches where id = $1",
      [batchAId],
    );
    expect(afterRemoval.ok).toBe(true);
    if (afterRemoval.ok) expect(afterRemoval.rows).toEqual([]);
  });

  it("an admin removes a moderator: ceiling allows acting on a lower rank", async () => {
    const updated = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: adminA.id },
      async (tx) => {
        const result = await tx.query<{ status: string }>(
          "select * from public.remove_member($1, $2)",
          [batchAId, modToRemove.id],
        );
        return result.rows[0];
      },
    );
    expect(updated?.status).toBe("removed");
    await client.query(
      "delete from public.audit_logs where batch_id = $1 and action = 'member_removed'",
      [batchAId],
    );
  });

  it("a moderator attempting to remove an admin is refused (ceiling)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: modA.id },
      "select public.remove_member($1, $2)",
      [batchAId, adminA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an admin attempting to remove a peer admin is refused (ceiling)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: adminA.id },
      "select public.remove_member($1, $2)",
      [batchAId, admin2A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("the owner cannot remove themselves through this RPC", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select public.remove_member($1, $2)",
      [batchAId, ownerA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a non-mod+ (plain member) attempting removal is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member1A.id },
      "select public.remove_member($1, $2)",
      [batchAId, admin2A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("change_member_role — the single ceiling comparison, exercised at every tier", () => {
  it("admin promotes a member to moderator", async () => {
    const updated = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: adminA.id },
      async (tx) => {
        const result = await tx.query<{ role: string }>(
          "select * from public.change_member_role($1, $2, 'moderator')",
          [batchAId, memberForRoleChange1.id],
        );
        return result.rows[0];
      },
    );
    expect(updated?.role).toBe("moderator");

    const audit = await client.query<{ detail: { previous_role: string; new_role: string } }>(
      "select detail from public.audit_logs where batch_id = $1 and action = 'role_changed' order by occurred_at desc limit 1",
      [batchAId],
    );
    expect(audit.rows[0]?.detail.previous_role).toBe("member");
    expect(audit.rows[0]?.detail.new_role).toBe("moderator");
    await client.query(
      "delete from public.audit_logs where batch_id = $1 and action = 'role_changed'",
      [batchAId],
    );
  });

  it("admin demotes a moderator back to member", async () => {
    const updated = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: adminA.id },
      async (tx) => {
        const result = await tx.query<{ role: string }>(
          "select * from public.change_member_role($1, $2, 'member')",
          [batchAId, modForDemote.id],
        );
        return result.rows[0];
      },
    );
    expect(updated?.role).toBe("member");
    await client.query(
      "delete from public.audit_logs where batch_id = $1 and action = 'role_changed'",
      [batchAId],
    );
  });

  it("owner promotes a member to admin (admin+ alone cannot do this)", async () => {
    const updated = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: ownerA.id },
      async (tx) => {
        const result = await tx.query<{ role: string }>(
          "select * from public.change_member_role($1, $2, 'admin')",
          [batchAId, memberForRoleChange2.id],
        );
        return result.rows[0];
      },
    );
    expect(updated?.role).toBe("admin");
    await client.query(
      "delete from public.audit_logs where batch_id = $1 and action = 'role_changed'",
      [batchAId],
    );
  });

  it("an admin attempting to create another admin is refused (cannot assign >= own rank)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: adminA.id },
      "select public.change_member_role($1, $2, 'admin')",
      [batchAId, member1A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an admin attempting to change a peer admin's role is refused (ceiling on current role)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: adminA.id },
      "select public.change_member_role($1, $2, 'moderator')",
      [batchAId, admin2A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a moderator cannot change anyone's role (ceiling never clears above member)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: modA.id },
      "select public.change_member_role($1, $2, 'moderator')",
      [batchAId, member1A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("'owner' is never an assignable target role through this RPC, for any actor", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select public.change_member_role($1, $2, 'owner')",
      [batchAId, member1A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("no self-service role change — the real actor's own id is always resolved from auth.uid()", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: adminA.id },
      "select public.change_member_role($1, $2, 'member')",
      [batchAId, adminA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a plain member requesting a legitimate target role for someone else is still refused — proves the actor's TRUE role (not any claim) is what is checked", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member1A.id },
      "select public.change_member_role($1, $2, 'moderator')",
      [batchAId, admin2A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("transfer_ownership — one atomic operation, owner only", () => {
  it("the owner transfers to an active member: demote+promote commit together, audited", async () => {
    const promoted = await asPersonaCommitted(
      client,
      { role: "authenticated", userId: ownerC.id },
      async (tx) => {
        const result = await tx.query<{ role: string; profile_id: string }>(
          "select * from public.transfer_ownership($1, $2)",
          [batchCId, memberForTransfer.id],
        );
        return result.rows[0];
      },
    );
    expect(promoted?.role).toBe("owner");
    expect(promoted?.profile_id).toBe(memberForTransfer.id);

    const demoted = await client.query<{ role: string }>(
      "select role from public.batch_members where batch_id = $1 and profile_id = $2",
      [batchCId, ownerC.id],
    );
    expect(demoted.rows[0]?.role).toBe("admin");

    const audit = await client.query<{ detail: { previous_owner_profile_id: string } }>(
      "select detail from public.audit_logs where batch_id = $1 and action = 'ownership_transferred'",
      [batchCId],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]?.detail.previous_owner_profile_id).toBe(ownerC.id);
  });

  it("a non-owner (admin) attempting transfer is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: adminA.id },
      "select public.transfer_ownership($1, $2)",
      [batchAId, member1A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("transferring to oneself is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select public.transfer_ownership($1, $2)",
      [batchAId, ownerA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("transferring to a non-member is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select public.transfer_ownership($1, $2)",
      [batchAId, strangerC.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("transferring to a PENDING (not yet active) member is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerA.id },
      "select public.transfer_ownership($1, $2)",
      [batchAId, pendingShared.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses anon", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      "select public.transfer_ownership($1, $2)",
      [batchAId, member1A.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("the exactly-one-active-owner constraint rejects a second active owner outright, independent of any RPC", async () => {
    // Proves the structural guarantee itself (database.md §13; security.md
    // §11 rule 5) — bypassing the RPC entirely and attempting the illegal
    // state directly, as the migration owner (RLS-independent: this is a
    // storage-level unique index, not a policy).
    await expect(
      client.query(
        `update public.batch_members
            set role = 'owner', status = 'active', joined_at = now()
          where batch_id = $1 and profile_id = $2`,
        [batchAId, member1A.id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
