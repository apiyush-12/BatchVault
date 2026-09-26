import { randomUUID } from "node:crypto";

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestUser,
  deleteAvatarObject,
  deleteTestUser,
  seedAvatarObject,
  type TestUser,
} from "./support/auth-fixtures";
import { asPersona, attempt, connect } from "./support/db";

/**
 * Phase 1 adversarial suite for `profiles` (testing.md §3.1; security.md
 * §5.4, §5.4.1, §5.4.3, §6.1). Called directly against the database,
 * impersonating each persona (testing.md §2.3) — this is not a test of the
 * application, it is a test of the boundary the application sits behind.
 *
 * `profiles.id` carries a real FK to `auth.users`, so every persona here is a
 * genuine, disposable Auth user created via the Admin API and deleted at the
 * end — never a synthetic UUID (see support/auth-fixtures.ts).
 */

let client: Client;
let userA: TestUser;
let userB: TestUser;

const AVATAR_A_PATH = () => `${userA.id}/seeded-avatar`;

beforeAll(async () => {
  client = await connect();
  [userA, userB] = await Promise.all([createTestUser(), createTestUser()]);
});

afterAll(async () => {
  await deleteAvatarObject(AVATAR_A_PATH()).catch(() => undefined);
  await Promise.all([
    deleteTestUser(userA.id).catch(() => undefined),
    deleteTestUser(userB.id).catch(() => undefined),
  ]);
  await client.end();
});

describe("profiles — unauthenticated access", () => {
  it("refuses an anonymous read", async () => {
    const result = await attempt(client, { role: "anon" }, "select * from public.profiles");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("42501");
    }
  });

  it("refuses an anonymous insert", async () => {
    const result = await attempt(
      client,
      { role: "anon" },
      "insert into public.profiles (display_name) values ('nope')",
    );
    expect(result.ok).toBe(false);
  });
});

describe("profiles — identity on insert", () => {
  it("creates the caller's own row when id is omitted (defaults to auth.uid())", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "insert into public.profiles (display_name) values ('User A') returning id::text as id",
    );
    expect(result.ok).toBe(true);
    // Rolled back by asPersona — userA still has no committed row after this.
  });

  it("refuses INSERT of a profile row whose id is another auth user's id", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "insert into public.profiles (id, display_name) values ($1, 'Forged') returning id",
      [userB.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // No INSERT grant on the id column at all — refused at the privilege
      // level, not merely by a policy (security.md §5.4.1, §5.6).
      expect(result.error.code).toBe("42501");
    }
  });
});

describe("profiles — column-level enforcement on UPDATE", () => {
  beforeAll(async () => {
    // A real, committed row for userA — needed because §UPDATE tests must
    // observe a real row across the rolled-back attempt() transactions.
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, 'User A') on conflict (id) do nothing",
      [userA.id],
    );
  });

  it("allows the owner to update their own display_name and bio", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "update public.profiles set display_name = 'User A (updated)', bio = 'hello' where id = $1 returning display_name",
      [userA.id],
    );
    expect(result.ok).toBe(true);
  });

  it("refuses the owner rewriting their own id", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "update public.profiles set id = $1 where id = $2",
      [userB.id, userA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses the owner setting deleted_at on their own row", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "update public.profiles set deleted_at = now() where id = $1",
      [userA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses the owner setting onboarding_completed_at directly, with a caller-chosen timestamp", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "update public.profiles set onboarding_completed_at = timestamptz '2001-01-01' where id = $1",
      [userA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses setting onboarding_completed_at on another user's row", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "update public.profiles set onboarding_completed_at = now() where id = $1",
      [userB.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses the owner setting avatar_path directly to an arbitrary path", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "update public.profiles set avatar_path = 'not-a-real-object' where id = $1",
      [userA.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("profiles — the onboarding-completion controlled write path (matched pair)", () => {
  it("succeeds for the caller's own row and is idempotent", async () => {
    const first = await attempt<{ onboarding_completed_at: string | null }>(
      client,
      { role: "authenticated", userId: userA.id },
      "select onboarding_completed_at from public.complete_onboarding()",
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.rows[0]?.onboarding_completed_at).not.toBeNull();

    const firstValue = first.rows[0]?.onboarding_completed_at;
    expect(firstValue).not.toBeNull();

    // Re-running does not rewrite an already-set completion (security.md
    // §5.4.3's stated precondition) — two sequential calls inside one
    // persona transaction, so ordering is unambiguous.
    const { firstCall, secondCall } = await asPersona(
      client,
      { role: "authenticated", userId: userA.id },
      async (tx) => {
        const a = await tx.query<{ onboarding_completed_at: string | null }>(
          "select onboarding_completed_at from public.complete_onboarding()",
        );
        const b = await tx.query<{ onboarding_completed_at: string | null }>(
          "select onboarding_completed_at from public.complete_onboarding()",
        );
        return {
          firstCall: a.rows[0]?.onboarding_completed_at,
          secondCall: b.rows[0]?.onboarding_completed_at,
        };
      },
    );
    expect(firstCall).not.toBeNull();
    // pg returns timestamptz as Date objects, so two distinct instances of
    // the same instant are never `Object.is`-equal — compare by value.
    expect(secondCall).toEqual(firstCall);
  });

  it("refuses an unauthenticated caller", async () => {
    const result = await attempt(client, { role: "anon" }, "select public.complete_onboarding()");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses a caller with no profile row yet", async () => {
    const stranger = await createTestUser();
    try {
      const result = await attempt(
        client,
        { role: "authenticated", userId: stranger.id },
        "select public.complete_onboarding()",
      );
      expect(result.ok).toBe(false);
    } finally {
      await deleteTestUser(stranger.id);
    }
  });
});

describe("profiles — the avatar-path controlled write path", () => {
  beforeAll(async () => {
    await seedAvatarObject(AVATAR_A_PATH());
  });

  it("succeeds for a real object under the caller's own prefix", async () => {
    const result = await attempt<{ avatar_path: string | null }>(
      client,
      { role: "authenticated", userId: userA.id },
      "select avatar_path from public.set_own_avatar_path($1)",
      [AVATAR_A_PATH()],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]?.avatar_path).toBe(AVATAR_A_PATH());
  });

  it("refuses another profile's avatar object", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userB.id },
      "select public.set_own_avatar_path($1)",
      [AVATAR_A_PATH()],
    );
    expect(result.ok).toBe(false);
  });

  it("refuses an arbitrary/batch-media-shaped path", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "select public.set_own_avatar_path($1)",
      [`${randomUUID()}/${randomUUID()}`],
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a well-formed own-prefix path with no real object behind it", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: userA.id },
      "select public.set_own_avatar_path($1)",
      [`${userA.id}/${randomUUID()}`],
    );
    expect(result.ok).toBe(false);
  });
});

describe("profiles — EXECUTE grants", () => {
  it("refuses anon on both controlled write paths", async () => {
    const onboarding = await attempt(client, { role: "anon" }, "select public.complete_onboarding()");
    const avatar = await attempt(
      client,
      { role: "anon" },
      "select public.set_own_avatar_path($1)",
      ["x/y"],
    );
    expect(onboarding.ok).toBe(false);
    expect(avatar.ok).toBe(false);
  });
});
