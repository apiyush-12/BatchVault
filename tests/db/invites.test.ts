import { createHash, randomBytes } from "node:crypto";

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteTestUser, type TestUser } from "./support/auth-fixtures";
import { asPersona, asPersonaCommitted, attempt, connect } from "./support/db";

/**
 * Phase 3A adversarial suite for `batch_invites`, `invite_redemption_attempts`,
 * and the four privileged RPCs this phase introduces: `create_invite`,
 * `revoke_invite`, `validate_invite`, `redeem_invite` (testing.md §3.3, §3.4,
 * §5; security.md §5.2, §9, §9.1, §10, §17, §20).
 *
 * Called directly against the database, impersonating each persona
 * (testing.md §2.3). Token hashing mirrors `features/invitations/token.ts`
 * exactly, but is reimplemented locally rather than imported — this suite
 * tests the database boundary directly, not through the application layer
 * (security.md §1.3; testing.md §1 philosophy point 1).
 */

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function freshTokenHash(): string {
  return hashToken(randomBytes(32).toString("base64url"));
}

let client: Client;

let ownerAuto: TestUser; // owner of batchAuto (invite_only_auto_approve)
let adminAuto: TestUser; // admin of batchAuto
let memberAuto: TestUser; // plain active member of batchAuto
let ownerApproval: TestUser; // owner of batchApproval (invite_only_requires_approval)
let removedApproval: TestUser; // REMOVED former member of batchApproval
let strangerC: TestUser; // belongs to neither batch
let joinerE: TestUser; // fresh user used to redeem invites
let joinerF: TestUser; // second fresh user, for the concurrency test

let batchAutoId: string;
let batchApprovalId: string;

async function seedBatch(
  name: string,
  ownerId: string,
  joinPolicy: "invite_only_auto_approve" | "invite_only_requires_approval",
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.batches (name, institution_name, created_by, join_policy)
     values ($1, 'Test University', $2, $3)
     returning id`,
    [name, ownerId, joinPolicy],
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
  role: "member" | "admin",
  status: "active" | "removed",
): Promise<void> {
  if (status === "active") {
    await client.query(
      `insert into public.batch_members (batch_id, profile_id, role, status, joined_at, decided_at, decided_by)
       values ($1, $2, $3, 'active', now(), now(), $2)`,
      [batchId, profileId, role],
    );
  } else {
    await client.query(
      `insert into public.batch_members (batch_id, profile_id, role, status, decided_at, decided_by)
       values ($1, $2, $3, 'removed', now(), $2)`,
      [batchId, profileId, role],
    );
  }
}

async function seedInvite(
  batchId: string,
  options: {
    tokenHash?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
    revokedAt?: string | null;
    useCount?: number;
  } = {},
): Promise<{ id: string; tokenHash: string }> {
  const tokenHash = options.tokenHash ?? freshTokenHash();
  const { rows } = await client.query<{ id: string }>(
    `insert into public.batch_invites (batch_id, token_hash, max_uses, expires_at, revoked_at, use_count)
     values ($1, $2, $3, $4, $5, coalesce($6, 0))
     returning id`,
    [
      batchId,
      tokenHash,
      options.maxUses ?? null,
      options.expiresAt ?? null,
      options.revokedAt ?? null,
      options.useCount ?? null,
    ],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("failed to seed invite fixture");
  return { id, tokenHash };
}

beforeAll(async () => {
  client = await connect();
  [ownerAuto, adminAuto, memberAuto, ownerApproval, removedApproval, strangerC, joinerE, joinerF] =
    await Promise.all([
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
    ]);

  for (const user of [
    ownerAuto,
    adminAuto,
    memberAuto,
    ownerApproval,
    removedApproval,
    strangerC,
    joinerE,
    joinerF,
  ]) {
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
      [user.id, `Test ${user.email}`],
    );
  }

  batchAutoId = await seedBatch("Invite Auto Batch", ownerAuto.id, "invite_only_auto_approve");
  batchApprovalId = await seedBatch(
    "Invite Approval Batch",
    ownerApproval.id,
    "invite_only_requires_approval",
  );

  await seedMember(batchAutoId, adminAuto.id, "admin", "active");
  await seedMember(batchAutoId, memberAuto.id, "member", "active");
  await seedMember(batchApprovalId, removedApproval.id, "member", "removed");
});

afterAll(async () => {
  await client.query("delete from public.batches where id in ($1, $2)", [
    batchAutoId,
    batchApprovalId,
  ]);
  await Promise.all(
    [
      ownerAuto,
      adminAuto,
      memberAuto,
      ownerApproval,
      removedApproval,
      strangerC,
      joinerE,
      joinerF,
    ].map((user) => deleteTestUser(user.id).catch(() => undefined)),
  );
  await client.end();
});

describe("batch_invites — table privileges and column-level token_hash exclusion", () => {
  it("anon cannot select batch_invites at all", async () => {
    const result = await attempt(client, { role: "anon" }, "select * from public.batch_invites");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("anon cannot insert a batch_invites row", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      "insert into public.batch_invites (batch_id, token_hash) values ($1, $2)",
      [batchAutoId, freshTokenHash()],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("admin+ of the batch can select the safe columns, but NEVER token_hash", async () => {
    const { id } = await seedInvite(batchAutoId);

    const safe = await attempt(
      client,
      { role: "authenticated", userId: adminAuto.id },
      "select id, batch_id, max_uses, use_count, expires_at, revoked_at, created_by from public.batch_invites where id = $1",
      [id],
    );
    expect(safe.ok).toBe(true);
    if (safe.ok) expect(safe.rows).toHaveLength(1);

    const hashColumn = await attempt(
      client,
      { role: "authenticated", userId: adminAuto.id },
      "select token_hash from public.batch_invites where id = $1",
      [id],
    );
    expect(hashColumn.ok).toBe(false);
    if (!hashColumn.ok) expect(hashColumn.error.code).toBe("42501");
  });

  it("a plain member of the batch sees NO invites (RLS, not a privilege error)", async () => {
    await seedInvite(batchAutoId);
    const result = await attempt<{ id: string }>(
      client,
      { role: "authenticated", userId: memberAuto.id },
      "select id, batch_id, max_uses, use_count, expires_at, revoked_at, created_by from public.batch_invites where batch_id = $1",
      [batchAutoId],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([]);
  });

  it("no one — not even the admin who created it — can UPDATE or DELETE an invite directly", async () => {
    const { id } = await seedInvite(batchAutoId);

    const update = await attempt(
      client,
      { role: "authenticated", userId: adminAuto.id },
      "update public.batch_invites set revoked_at = now() where id = $1",
      [id],
    );
    const del = await attempt(
      client,
      { role: "authenticated", userId: adminAuto.id },
      "delete from public.batch_invites where id = $1",
      [id],
    );
    expect(update.ok).toBe(false);
    if (!update.ok) expect(update.error.code).toBe("42501");
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error.code).toBe("42501");
  });
});

describe("check_invite_rate_limit — no client role may call the private helper directly", () => {
  it("refuses anon and authenticated alike", async () => {
    const anonResult = await attempt(client, { role: "anon" }, "select public.check_invite_rate_limit(null, null)");
    expect(anonResult.ok).toBe(false);
    if (!anonResult.ok) expect(anonResult.error.code).toBe("42501");

    const authResult = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select public.check_invite_rate_limit(null, $1)",
      [strangerC.id],
    );
    expect(authResult.ok).toBe(false);
    if (!authResult.ok) expect(authResult.error.code).toBe("42501");
  });
});

describe("create_invite — admin+ only, audited (security.md §4, §9, §20)", () => {
  it("an admin can create an invite; the result never includes token_hash", async () => {
    const row = await asPersona(client, { role: "authenticated", userId: adminAuto.id }, async (tx) => {
      const result = await tx.query<Record<string, unknown>>(
        "select * from public.create_invite($1, $2, $3, $4)",
        [batchAutoId, freshTokenHash(), 5, null],
      );
      return result.rows[0];
    });

    expect(row).toBeDefined();
    expect(row?.max_uses).toBe(5);
    expect(row).not.toHaveProperty("token_hash");
  });

  it("the owner (admin+) can also create an invite", async () => {
    const row = await asPersona(client, { role: "authenticated", userId: ownerAuto.id }, async (tx) => {
      const result = await tx.query<{ id: string }>("select * from public.create_invite($1, $2)", [
        batchAutoId,
        freshTokenHash(),
      ]);
      return result.rows[0];
    });
    expect(row?.id).toBeDefined();
  });

  it("a plain member (below admin) is refused", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberAuto.id },
      "select public.create_invite($1, $2)",
      [batchAutoId, freshTokenHash()],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a non-member is refused — same shape as 'not admin' (indistinguishable denial)", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: strangerC.id },
      "select public.create_invite($1, $2)",
      [batchAutoId, freshTokenHash()],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an admin of a DIFFERENT batch cannot create an invite for this one", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerApproval.id },
      "select public.create_invite($1, $2)",
      [batchAutoId, freshTokenHash()],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses anon", async () => {
    const result = await attempt(client, { role: "anon" }, "select public.create_invite($1, $2)", [
      batchAutoId,
      freshTokenHash(),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("writes exactly one audit_logs row recording the actor and action", async () => {
    let createdId: string | undefined;
    try {
      createdId = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: adminAuto.id },
        async (tx) => {
          const result = await tx.query<{ id: string }>("select * from public.create_invite($1, $2)", [
            batchAutoId,
            freshTokenHash(),
          ]);
          return result.rows[0]?.id;
        },
      );

      const auditRows = await client.query<{
        action: string;
        actor_profile_id: string;
        actor_role: string;
      }>(
        `select action, actor_profile_id, actor_role from public.audit_logs
          where target_id = $1 and action = 'invite_created'`,
        [createdId],
      );
      expect(auditRows.rows).toHaveLength(1);
      expect(auditRows.rows[0]?.actor_profile_id).toBe(adminAuto.id);
      expect(auditRows.rows[0]?.actor_role).toBe("admin");
    } finally {
      if (createdId !== undefined) {
        await client.query("delete from public.audit_logs where target_id = $1", [createdId]);
        await client.query("delete from public.batch_invites where id = $1", [createdId]);
      }
    }
  });
});

describe("revoke_invite — admin+ only, idempotent, audited", () => {
  it("an admin can revoke; a second revoke is a no-op, not a duplicate audit row", async () => {
    const { id } = await seedInvite(batchAutoId);
    try {
      const first = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: adminAuto.id },
        async (tx) => {
          const result = await tx.query<{ revoked_at: string | null }>(
            "select * from public.revoke_invite($1)",
            [id],
          );
          return result.rows[0];
        },
      );
      expect(first?.revoked_at).not.toBeNull();

      await asPersonaCommitted(client, { role: "authenticated", userId: adminAuto.id }, async (tx) => {
        await tx.query("select * from public.revoke_invite($1)", [id]);
      });

      const auditRows = await client.query<{ count: string }>(
        "select count(*)::text as count from public.audit_logs where target_id = $1 and action = 'invite_revoked'",
        [id],
      );
      expect(Number(auditRows.rows[0]?.count)).toBe(1);
    } finally {
      await client.query("delete from public.audit_logs where target_id = $1", [id]);
    }
  });

  it("a plain member is refused", async () => {
    const { id } = await seedInvite(batchAutoId);
    const result = await attempt(
      client,
      { role: "authenticated", userId: memberAuto.id },
      "select public.revoke_invite($1)",
      [id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an admin of a DIFFERENT batch cannot revoke this invite", async () => {
    const { id } = await seedInvite(batchAutoId);
    const result = await attempt(
      client,
      { role: "authenticated", userId: ownerApproval.id },
      "select public.revoke_invite($1)",
      [id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses anon", async () => {
    const { id } = await seedInvite(batchAutoId);
    const result = await attempt(client, { role: "anon" }, "select public.revoke_invite($1)", [id]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("validate_invite — the minimal unauthenticated-capable read (security.md §5.4, §9)", () => {
  it("returns the batch name for a valid invite, callable by ANON", async () => {
    const { tokenHash } = await seedInvite(batchAutoId);
    const result = await attempt<{ validate_invite: string }>(
      client,
      { role: "anon" },
      "select public.validate_invite($1) as validate_invite",
      [tokenHash],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows[0]?.validate_invite).toBe("Invite Auto Batch");
  });

  it("is also callable by an authenticated visitor", async () => {
    const { tokenHash } = await seedInvite(batchAutoId);
    const result = await attempt<{ validate_invite: string }>(
      client,
      { role: "authenticated", userId: joinerE.id },
      "select public.validate_invite($1) as validate_invite",
      [tokenHash],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows[0]?.validate_invite).toBe("Invite Auto Batch");
  });

  it("a never-issued token is refused generically", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      "select public.validate_invite($1)",
      [freshTokenHash()],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a revoked invite is refused — the SAME generic shape as never-issued", async () => {
    const { tokenHash } = await seedInvite(batchAutoId, { revokedAt: new Date().toISOString() });
    const result = await attempt(client, { role: "anon" }, "select public.validate_invite($1)", [
      tokenHash,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an expired invite is refused — the SAME generic shape", async () => {
    const { tokenHash } = await seedInvite(batchAutoId, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const result = await attempt(client, { role: "anon" }, "select public.validate_invite($1)", [
      tokenHash,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an exhausted (max_uses reached) invite is refused — the SAME generic shape", async () => {
    const { tokenHash } = await seedInvite(batchAutoId, { maxUses: 1, useCount: 1 });
    const result = await attempt(client, { role: "anon" }, "select public.validate_invite($1)", [
      tokenHash,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("does NOT mutate use_count — it is a preview, not a redemption", async () => {
    const { id, tokenHash } = await seedInvite(batchAutoId);
    await attempt(client, { role: "anon" }, "select public.validate_invite($1)", [tokenHash]);
    const { rows } = await client.query<{ use_count: number }>(
      "select use_count from public.batch_invites where id = $1",
      [id],
    );
    expect(rows[0]?.use_count).toBe(0);
  });

  it("rate-limits by IP: 20 attempts already on record refuses the 21st", async () => {
    const rateLimitIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    await client.query(
      `insert into public.invite_redemption_attempts (ip, attempted_at)
       select $1, now() from generate_series(1, 20)`,
      [rateLimitIp],
    );
    try {
      const { tokenHash } = await seedInvite(batchAutoId);
      // The rate-limit check runs before token lookup, inside the same
      // SECURITY DEFINER function — a valid token does not bypass it.
      const result = await asPersona(client, { role: "anon" }, async (tx) => {
        try {
          await tx.query("select public.validate_invite($1, $2)", [tokenHash, rateLimitIp]);
          return { ok: true as const };
        } catch (error) {
          return { ok: false as const, error };
        }
      });
      expect(result.ok).toBe(false);
    } finally {
      await client.query("delete from public.invite_redemption_attempts where ip = $1", [
        rateLimitIp,
      ]);
    }
  });
});

describe("redeem_invite — atomic membership creation (security.md §5.2, §9, §10)", () => {
  it("refuses anon — redemption requires a real identity", async () => {
    const { tokenHash } = await seedInvite(batchAutoId);
    const result = await attempt(client, { role: "anon" }, "select public.redeem_invite($1)", [
      tokenHash,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("auto-approve policy: redemption creates an ACTIVE membership, role always 'member'", async () => {
    const { id, tokenHash } = await seedInvite(batchAutoId);
    try {
      await asPersonaCommitted(client, { role: "authenticated", userId: joinerE.id }, async (tx) => {
        const result = await tx.query<{ batch_id: string; batch_name: string; status: string }>(
          "select * from public.redeem_invite($1)",
          [tokenHash],
        );
        expect(result.rows[0]?.status).toBe("active");
        expect(result.rows[0]?.batch_name).toBe("Invite Auto Batch");
      });

      const membership = await client.query<{ role: string; status: string; invite_id: string | null }>(
        "select role, status, invite_id from public.batch_members where batch_id = $1 and profile_id = $2",
        [batchAutoId, joinerE.id],
      );
      expect(membership.rows[0]?.role).toBe("member");
      expect(membership.rows[0]?.status).toBe("active");
      expect(membership.rows[0]?.invite_id).toBe(id);

      const invite = await client.query<{ use_count: number }>(
        "select use_count from public.batch_invites where id = $1",
        [id],
      );
      expect(invite.rows[0]?.use_count).toBe(1);
    } finally {
      await client.query("delete from public.batch_members where batch_id = $1 and profile_id = $2", [
        batchAutoId,
        joinerE.id,
      ]);
    }
  });

  it("requires-approval policy: redemption creates a PENDING membership with zero access implied", async () => {
    const { tokenHash } = await seedInvite(batchApprovalId);
    try {
      await asPersonaCommitted(client, { role: "authenticated", userId: joinerE.id }, async (tx) => {
        const result = await tx.query<{ status: string }>("select * from public.redeem_invite($1)", [
          tokenHash,
        ]);
        expect(result.rows[0]?.status).toBe("pending");
      });

      const membership = await client.query<{ status: string; joined_at: string | null }>(
        "select status, joined_at from public.batch_members where batch_id = $1 and profile_id = $2",
        [batchApprovalId, joinerE.id],
      );
      expect(membership.rows[0]?.status).toBe("pending");
      expect(membership.rows[0]?.joined_at).toBeNull();
    } finally {
      await client.query("delete from public.batch_members where batch_id = $1 and profile_id = $2", [
        batchApprovalId,
        joinerE.id,
      ]);
    }
  });

  it("is idempotent: redeeming again after already active does NOT double-charge use_count", async () => {
    const { id, tokenHash } = await seedInvite(batchAutoId);
    try {
      await asPersonaCommitted(client, { role: "authenticated", userId: joinerE.id }, async (tx) => {
        await tx.query("select public.redeem_invite($1)", [tokenHash]);
      });
      const second = await asPersonaCommitted(
        client,
        { role: "authenticated", userId: joinerE.id },
        async (tx) => {
          const result = await tx.query<{ status: string }>(
            "select * from public.redeem_invite($1)",
            [tokenHash],
          );
          return result.rows[0]?.status;
        },
      );
      expect(second).toBe("active");

      const invite = await client.query<{ use_count: number }>(
        "select use_count from public.batch_invites where id = $1",
        [id],
      );
      expect(invite.rows[0]?.use_count).toBe(1);
    } finally {
      await client.query("delete from public.batch_members where batch_id = $1 and profile_id = $2", [
        batchAutoId,
        joinerE.id,
      ]);
    }
  });

  it("a REMOVED member redeeming a fresh link does NOT silently rejoin", async () => {
    const { tokenHash } = await seedInvite(batchApprovalId);
    const result = await attempt(
      client,
      { role: "authenticated", userId: removedApproval.id },
      "select public.redeem_invite($1)",
      [tokenHash],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");

    const stillRemoved = await client.query<{ status: string }>(
      "select status from public.batch_members where batch_id = $1 and profile_id = $2",
      [batchApprovalId, removedApproval.id],
    );
    expect(stillRemoved.rows[0]?.status).toBe("removed");
  });

  it("a revoked invite is refused — redemption never bypasses revocation", async () => {
    const { tokenHash } = await seedInvite(batchAutoId, { revokedAt: new Date().toISOString() });
    const result = await attempt(
      client,
      { role: "authenticated", userId: joinerE.id },
      "select public.redeem_invite($1)",
      [tokenHash],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("an exhausted invite is refused — use caps are enforced", async () => {
    const { tokenHash } = await seedInvite(batchAutoId, { maxUses: 1, useCount: 1 });
    const result = await attempt(
      client,
      { role: "authenticated", userId: joinerE.id },
      "select public.redeem_invite($1)",
      [tokenHash],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("concurrent redemption of a single-use invite succeeds exactly once (testing.md §5)", async () => {
    const { id, tokenHash } = await seedInvite(batchAutoId, { maxUses: 1 });
    const clientX = await connect();
    const clientY = await connect();

    try {
      const run = (tx: Client, userId: string) =>
        asPersonaCommitted(tx, { role: "authenticated", userId }, async (inner) => {
          try {
            await inner.query("select public.redeem_invite($1)", [tokenHash]);
            return { ok: true as const };
          } catch (error) {
            return { ok: false as const, error };
          }
        });

      const [resultX, resultY] = await Promise.all([
        run(clientX, joinerE.id),
        run(clientY, joinerF.id),
      ]);

      const outcomes = [resultX, resultY];
      const succeeded = outcomes.filter((r) => r.ok);
      expect(succeeded).toHaveLength(1);

      const invite = await client.query<{ use_count: number }>(
        "select use_count from public.batch_invites where id = $1",
        [id],
      );
      expect(invite.rows[0]?.use_count).toBe(1);
    } finally {
      await clientX.end();
      await clientY.end();
      await client.query("delete from public.batch_members where batch_id = $1 and profile_id in ($2, $3)", [
        batchAutoId,
        joinerE.id,
        joinerF.id,
      ]);
    }
  });
});
