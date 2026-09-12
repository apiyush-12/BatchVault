import { randomUUID } from "node:crypto";

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PROBE_SCHEMA,
  admitOwnerOn,
  seedProbe,
  setupProbe,
  teardownProbe,
  type ProbeFixture,
} from "./support/b2-probe";
import { attempt, attemptAsRole, connect } from "./support/db";
import {
  prepareTargetEnvironment,
  type TargetEnvironment,
} from "./support/environment";

/**
 * B2 — the privileged-function execution model, verified against a real
 * PostgreSQL/Supabase environment (security.md §32 B2, §5.2.2, §5.3;
 * phases.md Phase 0).
 *
 * This file does not quote documentation at the problem. It creates
 * disposable probe objects, drives them as real personas, and records what
 * the database actually did. Every probe object is dropped afterwards and
 * none of them is a BatchVault product table.
 *
 * The tests run in file order and are cumulative: the owner role starts with
 * no policy admitting it, and admission is granted part-way through so the
 * before/after difference is observed rather than assumed.
 */

let client: Client;
let environment: TargetEnvironment;
let fixture: ProbeFixture;

const findings: Record<string, unknown> = {};

function record(key: string, value: unknown): void {
  findings[key] = value;
}

beforeAll(async () => {
  client = await connect();
  environment = await prepareTargetEnvironment(client);
  await setupProbe(client, environment.ownerRole);
  fixture = await seedProbe(client);

  record("environment", {
    kind: environment.kind,
    ownerRole: environment.ownerRole,
    serverVersion: environment.serverVersion,
    roleAttributes: environment.roleAttributes,
  });
});

afterAll(async () => {
  if (client !== undefined) {
    await teardownProbe(client);
    await client.end();
  }
  // The observed result is the deliverable, so it is printed rather than left
  // implicit in a green test run.
  console.log("\nB2 observed findings:\n" + JSON.stringify(findings, null, 2));
});

function ownerAttributes() {
  const attributes = environment.roleAttributes.find(
    (entry) => entry.role === environment.ownerRole,
  );
  if (attributes === undefined) {
    throw new Error(`owner role ${environment.ownerRole} not found`);
  }
  return attributes;
}

function ownerIsRlsExempt(): boolean {
  const owner = ownerAttributes();
  return owner.superuser || owner.bypassrls;
}

describe("B2 requirement 1 — identity inside a privileged function", () => {
  it("resolves auth.uid() to the calling user, not to the function owner", async () => {
    const uid = randomUUID();

    const outside = await attempt<{
      effective_role: string;
      uid: string | null;
    }>(
      client,
      { role: "authenticated", userId: uid },
      "select current_user::text as effective_role, auth.uid()::text as uid",
    );
    const inside = await attempt<{
      jwt_uid: string | null;
      session_role: string;
      effective_role: string;
    }>(
      client,
      { role: "authenticated", userId: uid },
      `select * from ${PROBE_SCHEMA}.whoami()`,
    );

    expect(outside.ok).toBe(true);
    expect(inside.ok).toBe(true);
    if (!outside.ok || !inside.ok) return;

    expect(outside.rows[0]?.effective_role).toBe("authenticated");
    expect(outside.rows[0]?.uid).toBe(uid);

    // The executing database role changes inside the definer function; the
    // JWT identity does not. auth.uid() reads request claims, not the role.
    expect(inside.rows[0]?.effective_role).toBe(environment.ownerRole);
    expect(inside.rows[0]?.jwt_uid).toBe(uid);

    record("requirement_1_identity_inside_definer", {
      callerRoleOutsideFunction: outside.rows[0]?.effective_role,
      authUidOutsideFunction: outside.rows[0]?.uid,
      executingRoleInsideFunction: inside.rows[0]?.effective_role,
      authUidInsideFunction: inside.rows[0]?.jwt_uid,
    });
  });

  it("resolves no identity for an anonymous caller", async () => {
    const result = await attempt<{ uid: string | null }>(
      client,
      { role: "anon" },
      "select auth.uid()::text as uid",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.uid).toBeNull();
  });
});

describe("B2 requirement 2 — the owner under FORCE ROW LEVEL SECURITY", () => {
  it("subjects the table owner's own statements to policies", async () => {
    const owner = ownerAttributes();

    // Rows exist. Whether the owner can see them is the question.
    const ownerRead = await attemptAsRole<{ count: string }>(
      client,
      environment.ownerRole,
      `select count(*)::text as count from ${PROBE_SCHEMA}.memberships`,
    );
    const ownerInsert = await attemptAsRole(
      client,
      environment.ownerRole,
      `insert into ${PROBE_SCHEMA}.unpolicied_writes (note) values ('owner-direct')`,
    );

    record("requirement_2_force_rls_vs_owner", {
      ownerRole: environment.ownerRole,
      ownerIsSuperuser: owner.superuser,
      ownerHasBypassRls: owner.bypassrls,
      ownerVisibleRowsInSeededTable: ownerRead.ok
        ? ownerRead.rows[0]?.count
        : `error: ${ownerRead.error.code}`,
      ownerInsertIntoTableWithNoPolicy: ownerInsert.ok
        ? "succeeded"
        : `refused: ${ownerInsert.error.code}`,
    });

    if (ownerIsRlsExempt()) {
      // Recorded rather than asserted away: an owner that bypasses RLS is
      // itself the finding, and means FORCE RLS is not what constrains it.
      expect(ownerRead.ok).toBe(true);
      expect(ownerInsert.ok).toBe(true);
    } else {
      expect(ownerRead.ok).toBe(true);
      expect(ownerRead.ok && ownerRead.rows[0]?.count).toBe("0");
      expect(ownerInsert.ok).toBe(false);
      if (!ownerInsert.ok) {
        expect(ownerInsert.error.code).toBe("42501");
      }
    }
  });

  it("exempts a BYPASSRLS role from the same forced policies", async () => {
    const serviceRole = environment.roleAttributes.find(
      (entry) => entry.role === "service_role",
    );
    const read = await attemptAsRole<{ count: string }>(
      client,
      "service_role",
      `select count(*)::text as count from ${PROBE_SCHEMA}.memberships`,
    );

    record("requirement_2b_bypassrls_role", {
      role: "service_role",
      hasBypassRls: serviceRole?.bypassrls,
      visibleRows: read.ok ? read.rows[0]?.count : `error: ${read.error.code}`,
    });

    if (serviceRole?.bypassrls === true) {
      expect(read.ok).toBe(true);
      expect(read.ok && Number(read.rows[0]?.count)).toBeGreaterThan(0);
    }
  });
});

describe("B2 requirement 3 — which configuration actually works", () => {
  it("a definer helper owned by a non-exempt owner sees nothing, without recursing", async () => {
    const helper = await attempt<{ result: boolean }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select ${PROBE_SCHEMA}.is_active_member($1) as result`,
      [fixture.batchA],
    );
    const rosterRead = await attempt<{ count: string }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select count(*)::text as count from ${PROBE_SCHEMA}.memberships`,
    );

    record("requirement_3a_before_owner_admission", {
      memberAsksIsActiveMember: helper.ok
        ? helper.rows[0]?.result
        : `error: ${helper.error.code}`,
      memberVisibleRosterRows: rosterRead.ok
        ? rosterRead.rows[0]?.count
        : `error: ${rosterRead.error.code}`,
      recursionError: rosterRead.ok ? "none" : rosterRead.error.code,
    });

    expect(helper.ok).toBe(true);
    expect(rosterRead.ok).toBe(true);
    if (!helper.ok || !rosterRead.ok) return;

    if (!ownerIsRlsExempt()) {
      // SECURITY DEFINER is not an RLS bypass. With FORCE RLS on and no
      // policy admitting the owner, the helper's own lookup returns nothing,
      // so every policy built on it denies — silently and completely.
      expect(helper.rows[0]?.result).toBe(false);
      expect(rosterRead.rows[0]?.count).toBe("0");
    }
  });

  it("refuses a definer write to a forced table that admits no one", async () => {
    const caller = fixture.inviteeUser;
    const direct = await attempt(
      client,
      { role: "authenticated", userId: caller },
      `insert into ${PROBE_SCHEMA}.unpolicied_writes (note) values ('caller-direct')`,
    );
    const viaFunction = await attempt(
      client,
      { role: "authenticated", userId: caller },
      `select ${PROBE_SCHEMA}.write_unpolicied('via-definer')`,
    );

    record("requirement_3b_definer_without_admission", {
      callerDirectInsert: direct.ok
        ? "succeeded"
        : `refused: ${direct.error.code}`,
      definerInsert: viaFunction.ok
        ? "succeeded"
        : `refused: ${viaFunction.error.code}`,
    });

    // The caller never holds the privilege at all.
    expect(direct.ok).toBe(false);
    if (!ownerIsRlsExempt()) {
      expect(viaFunction.ok).toBe(false);
    }
  });

  it("permits the same write once a policy admits the owner role", async () => {
    await admitOwnerOn(client, environment.ownerRole, "policied_writes");

    const result = await attempt<{ write_policied: string }>(
      client,
      { role: "authenticated", userId: fixture.inviteeUser },
      `select ${PROBE_SCHEMA}.write_policied('after-admission')::text as write_policied`,
    );

    record("requirement_3c_definer_with_owner_admission", {
      definerInsertAfterOwnerPolicy: result.ok
        ? "succeeded"
        : `refused: ${result.error.code}`,
    });

    expect(result.ok).toBe(true);
  });

  it("restores membership visibility once the owner is admitted on the roster", async () => {
    await admitOwnerOn(client, environment.ownerRole, "memberships");
    // Every table a privileged function reads needs the same admission, not
    // just the one it writes: the join RPC consults its entitlement source.
    await admitOwnerOn(client, environment.ownerRole, "invitees", {
      select: true,
    });

    const memberView = await attempt<{ count: string }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select count(*)::text as count from ${PROBE_SCHEMA}.memberships`,
    );
    const outsiderView = await attempt<{ count: string }>(
      client,
      { role: "authenticated", userId: fixture.outsiderUser },
      `select count(*)::text as count from ${PROBE_SCHEMA}.memberships where batch_id = $1`,
      [fixture.batchA],
    );

    record("requirement_3d_after_owner_admission", {
      memberVisibleRosterRows: memberView.ok ? memberView.rows[0]?.count : null,
      outsiderVisibleRowsInOtherBatch: outsiderView.ok
        ? outsiderView.rows[0]?.count
        : null,
    });

    // The member now sees exactly their own batch's roster, and no more.
    expect(memberView.ok && memberView.rows[0]?.count).toBe("1");
    expect(outsiderView.ok && outsiderView.rows[0]?.count).toBe("0");
  });
});

describe("B2 requirement 4 — the function must authorize auth.uid() itself", () => {
  it("admits an entitled caller and refuses an unentitled one", async () => {
    const entitled = await attempt<{ profile_id: string }>(
      client,
      { role: "authenticated", userId: fixture.inviteeUser },
      `select (${PROBE_SCHEMA}.join_batch($1)).profile_id::text as profile_id`,
      [fixture.batchA],
    );
    const unentitled = await attempt(
      client,
      { role: "authenticated", userId: fixture.outsiderUser },
      `select ${PROBE_SCHEMA}.join_batch($1)`,
      [fixture.batchA],
    );
    const unknownBatch = await attempt(
      client,
      { role: "authenticated", userId: fixture.outsiderUser },
      `select ${PROBE_SCHEMA}.join_batch($1)`,
      [randomUUID()],
    );

    expect(entitled.ok).toBe(true);
    expect(entitled.ok && entitled.rows[0]?.profile_id).toBe(
      fixture.inviteeUser,
    );
    expect(unentitled.ok).toBe(false);
    expect(unknownBatch.ok).toBe(false);

    record("requirement_4a_explicit_authorization", {
      entitledCaller: entitled.ok ? "membership created" : entitled.error,
      unentitledCaller: unentitled.ok
        ? "membership created"
        : `refused: ${unentitled.error.code}`,
      unknownBatchId: unknownBatch.ok
        ? "membership created"
        : `refused: ${unknownBatch.error.code}`,
      denialsIndistinguishable:
        !unentitled.ok &&
        !unknownBatch.ok &&
        unentitled.error.message === unknownBatch.error.message,
    });
  });

  it("writes for an unauthorized caller when the check is omitted", async () => {
    const result = await attempt<{ profile_id: string }>(
      client,
      { role: "authenticated", userId: fixture.outsiderUser },
      `select (${PROBE_SCHEMA}.join_batch_unchecked($1)).profile_id::text as profile_id`,
      [fixture.batchA],
    );

    record("requirement_4b_missing_authorization_is_fatal", {
      unentitledCallerViaUncheckedFunction: result.ok
        ? "membership created — nothing was standing behind the function"
        : `refused: ${result.error.code}`,
    });

    // The point of the experiment: the elevated function is the ONLY
    // boundary. Remove its check and an unauthorized caller gets the write.
    expect(result.ok).toBe(true);
    expect(result.ok && result.rows[0]?.profile_id).toBe(fixture.outsiderUser);
  });
});

describe("B2 requirement 5 — caller-asserted identity is never authoritative", () => {
  it("ignores forged actor and role parameters", async () => {
    const result = await attempt<{ profile_id: string; member_role: string }>(
      client,
      { role: "authenticated", userId: fixture.inviteeUser },
      `select r.profile_id::text as profile_id, r.member_role
         from ${PROBE_SCHEMA}.join_batch($1, $2, $3) r`,
      [fixture.batchA, fixture.outsiderUser, "owner"],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.profile_id).toBe(fixture.inviteeUser);
    expect(result.rows[0]?.member_role).toBe("member");

    record("requirement_5_forged_parameters", {
      claimedActor: fixture.outsiderUser,
      claimedRole: "owner",
      storedProfileId: result.rows[0]?.profile_id,
      storedRole: result.rows[0]?.member_role,
    });
  });
});

describe("B2 requirement 6 — EXECUTE grants restrict who may call", () => {
  it("refuses the anon role and admits the authenticated role", async () => {
    const anonCall = await attempt(
      client,
      { role: "anon" },
      `select ${PROBE_SCHEMA}.join_batch($1)`,
      [fixture.batchA],
    );
    const anonHelper = await attempt(
      client,
      { role: "anon" },
      `select ${PROBE_SCHEMA}.is_active_member($1)`,
      [fixture.batchA],
    );
    const authenticatedHelper = await attempt<{ result: boolean }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select ${PROBE_SCHEMA}.is_active_member($1) as result`,
      [fixture.batchA],
    );

    expect(anonCall.ok).toBe(false);
    expect(anonHelper.ok).toBe(false);
    expect(authenticatedHelper.ok).toBe(true);

    record("requirement_6_execute_grants", {
      anonCallsPrivilegedRpc: anonCall.ok
        ? "succeeded"
        : `refused: ${anonCall.error.code}`,
      anonCallsMembershipHelper: anonHelper.ok
        ? "succeeded"
        : `refused: ${anonHelper.error.code}`,
      authenticatedCallsMembershipHelper: authenticatedHelper.ok
        ? "succeeded"
        : "refused",
    });
  });
});

describe("B2 requirement 7 — the membership helper and policy recursion", () => {
  it("does not recurse through a definer helper, and does through an invoker one", async () => {
    const viaDefiner = await attempt<{ count: string }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select count(*)::text as count from ${PROBE_SCHEMA}.memberships`,
    );
    const viaInvoker = await attempt(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select count(*) from ${PROBE_SCHEMA}.recursive_memberships`,
    );

    record("requirement_7_recursion", {
      policyUsingDefinerHelper: viaDefiner.ok
        ? `${viaDefiner.rows[0]?.count} row(s), no recursion error`
        : `error: ${viaDefiner.error.code}`,
      policyUsingInvokerHelper: viaInvoker.ok
        ? "no error"
        : `error: ${viaInvoker.error.code}: ${viaInvoker.error.message}`,
    });

    expect(viaDefiner.ok).toBe(true);
    expect(viaInvoker.ok).toBe(false);
    if (!viaInvoker.ok) {
      // Either PostgreSQL detects the cycle (42P17) or it runs out of stack
      // first (54001). Both are the same defect: the query cannot complete.
      expect(["42P17", "54001"]).toContain(viaInvoker.error.code);
    }
  });
});

describe("B2 requirement 8 — the membership helper is not an oracle", () => {
  it("answers only about the current caller and leaks no batch existence", async () => {
    const ownBatch = await attempt<{ result: boolean }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select ${PROBE_SCHEMA}.is_active_member($1) as result`,
      [fixture.batchA],
    );
    const otherBatch = await attempt<{ result: boolean }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select ${PROBE_SCHEMA}.is_active_member($1) as result`,
      [fixture.batchB],
    );
    const nonexistentBatch = await attempt<{ result: boolean }>(
      client,
      { role: "authenticated", userId: fixture.memberUser },
      `select ${PROBE_SCHEMA}.is_active_member($1) as result`,
      [randomUUID()],
    );
    const crossBatchRead = await attempt<{ count: string }>(
      client,
      { role: "authenticated", userId: fixture.outsiderUser },
      `select count(*)::text as count from ${PROBE_SCHEMA}.batches where id = $1`,
      [fixture.batchA],
    );
    const directInsert = await attempt(
      client,
      { role: "authenticated", userId: fixture.outsiderUser },
      `insert into ${PROBE_SCHEMA}.memberships (batch_id, profile_id) values ($1, $2)`,
      [fixture.batchA, fixture.outsiderUser],
    );

    expect(ownBatch.ok && ownBatch.rows[0]?.result).toBe(true);
    expect(otherBatch.ok && otherBatch.rows[0]?.result).toBe(false);
    expect(nonexistentBatch.ok && nonexistentBatch.rows[0]?.result).toBe(false);
    expect(crossBatchRead.ok && crossBatchRead.rows[0]?.count).toBe("0");
    expect(directInsert.ok).toBe(false);

    record("requirement_8a_helper_is_not_an_oracle", {
      ownBatch: ownBatch.ok ? ownBatch.rows[0]?.result : ownBatch.error,
      anotherMembersBatch: otherBatch.ok ? otherBatch.rows[0]?.result : null,
      nonexistentBatch: nonexistentBatch.ok
        ? nonexistentBatch.rows[0]?.result
        : null,
      existenceIndistinguishable:
        otherBatch.ok &&
        nonexistentBatch.ok &&
        otherBatch.rows[0]?.result === nonexistentBatch.rows[0]?.result,
      outsiderVisibleBatchRows: crossBatchRead.ok
        ? crossBatchRead.rows[0]?.count
        : null,
      outsiderDirectMembershipInsert: directInsert.ok
        ? "succeeded"
        : `refused: ${directInsert.error.code}`,
    });
  });

  it("shows why a user-id parameter turns the same helper into an oracle", async () => {
    const leak = await attempt<{ result: boolean }>(
      client,
      { role: "authenticated", userId: fixture.outsiderUser },
      `select ${PROBE_SCHEMA}.is_member_oracle($1, $2) as result`,
      [fixture.batchA, fixture.memberUser],
    );

    record("requirement_8b_parameterised_helper_leaks", {
      outsiderAsksAboutAnotherUsersMembership: leak.ok
        ? leak.rows[0]?.result
        : leak.error,
    });

    // A demonstration, not a design: this is the shape security.md §5.3 bans.
    expect(leak.ok).toBe(true);
    expect(leak.ok && leak.rows[0]?.result).toBe(true);
  });
});
