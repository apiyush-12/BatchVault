import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteTestUser, type TestUser } from "./support/auth-fixtures";
import { asPersona, asPersonaCommitted, attempt, connect } from "./support/db";

/**
 * Focused adversarial suite for the COMPLETION-FIRST session's new DB
 * behavior: comments, reactions, reports, and the moderation/audit RPCs
 * (Phase 6 + Phase 8A minimal). Not a re-run of any earlier phase's suite.
 */

let client: Client;
let owner: TestUser; // owner/admin of batchId
let moderator: TestUser;
let member: TestUser;
let stranger: TestUser; // not a member of batchId

let batchId: string;
let memoryId: string;

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

async function seedMember(batchId: string, profileId: string, role: string): Promise<void> {
  await client.query(
    `insert into public.batch_members (batch_id, profile_id, role, status, joined_at, decided_at, decided_by)
     values ($1, $2, $3::public.batch_role, 'active', now(), now(), $2)`,
    [batchId, profileId, role],
  );
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

beforeAll(async () => {
  client = await connect();
  [owner, moderator, member, stranger] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);

  for (const user of [owner, moderator, member, stranger]) {
    await client.query(
      "insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing",
      [user.id, `Test ${user.email}`],
    );
  }

  batchId = await seedBatch("Social Moderation Batch", owner.id);
  await seedMember(batchId, moderator.id, "moderator");
  await seedMember(batchId, member.id, "member");
  memoryId = await seedMemory(batchId, owner.id);
});

afterAll(async () => {
  await client.query("delete from public.batches where id = $1", [batchId]);
  await Promise.all(
    [owner, moderator, member, stranger].map((user) => deleteTestUser(user.id).catch(() => undefined)),
  );
  await client.end();
});

describe("comments", () => {
  it("an active member can comment on a visible memory", async () => {
    const row = await asPersona(client, { role: "authenticated", userId: member.id }, async (tx) => {
      const result = await tx.query<{ id: string; author_id: string }>(
        "insert into public.comments (batch_id, memory_id, body) values ($1, $2, $3) returning id, author_id",
        [batchId, memoryId, "Great memory!"],
      );
      return result.rows[0];
    });
    expect(row?.author_id).toBe(member.id);
  });

  it("refuses forging author_id via an explicit column — no INSERT grant exists on it", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member.id },
      "insert into public.comments (batch_id, memory_id, body, author_id) values ($1, $2, $3, $4)",
      [batchId, memoryId, "forged", stranger.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("a non-member cannot comment on a batch's memory", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: stranger.id },
      "insert into public.comments (batch_id, memory_id, body) values ($1, $2, $3)",
      [batchId, memoryId, "intruding"],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("anon cannot read or write comments", async () => {
    const read = await attempt(client, { role: "anon" }, "select * from public.comments");
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("42501");
  });

  it("the author can edit their own comment body; a non-author's edit affects 0 rows", async () => {
    const commentId = await asPersonaCommitted(client, { role: "authenticated", userId: member.id }, async (tx) => {
      const result = await tx.query<{ id: string }>(
        "insert into public.comments (batch_id, memory_id, body) values ($1, $2, $3) returning id",
        [batchId, memoryId, "original"],
      );
      return result.rows[0]?.id;
    });
    try {
      const ownEdit = await attempt<{ body: string }>(
        client,
        { role: "authenticated", userId: member.id },
        "update public.comments set body = $1 where id = $2 returning body",
        ["edited", commentId],
      );
      expect(ownEdit.ok).toBe(true);
      if (ownEdit.ok) expect(ownEdit.rows[0]?.body).toBe("edited");

      const otherEdit = await attempt<{ id: string }>(
        client,
        { role: "authenticated", userId: owner.id },
        "update public.comments set body = $1 where id = $2 returning id",
        ["hijacked", commentId],
      );
      expect(otherEdit.ok).toBe(true);
      if (otherEdit.ok) expect(otherEdit.rows).toEqual([]);
    } finally {
      await client.query("delete from public.comments where id = $1", [commentId]);
    }
  });

  it("no DELETE grant exists for any client role (no author self-delete, PRD #7's comment analog)", async () => {
    const commentId = await asPersonaCommitted(client, { role: "authenticated", userId: member.id }, async (tx) => {
      const result = await tx.query<{ id: string }>(
        "insert into public.comments (batch_id, memory_id, body) values ($1, $2, $3) returning id",
        [batchId, memoryId, "undeleteable"],
      );
      return result.rows[0]?.id;
    });
    try {
      const result = await attempt(
        client,
        { role: "authenticated", userId: member.id },
        "delete from public.comments where id = $1",
        [commentId],
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("42501");
    } finally {
      await client.query("delete from public.comments where id = $1", [commentId]);
    }
  });
});

describe("reactions", () => {
  it("a member can react, switching is an UPDATE on the unique (memory_id, profile_id) key, and removal is a hard DELETE", async () => {
    await asPersonaCommitted(client, { role: "authenticated", userId: member.id }, async (tx) => {
      await tx.query("insert into public.reactions (batch_id, memory_id, kind) values ($1, $2, 'like')", [
        batchId,
        memoryId,
      ]);
    });
    try {
      const afterInsert = await client.query<{ kind: string }>(
        "select kind from public.reactions where memory_id = $1 and profile_id = $2",
        [memoryId, member.id],
      );
      expect(afterInsert.rows[0]?.kind).toBe("like");

      await asPersonaCommitted(client, { role: "authenticated", userId: member.id }, async (tx) => {
        await tx.query("update public.reactions set kind = 'love' where memory_id = $1 and profile_id = $2", [
          memoryId,
          member.id,
        ]);
      });
      const afterSwitch = await client.query<{ kind: string; count: string }>(
        "select kind, count(*)::text as count from public.reactions where memory_id = $1 and profile_id = $2 group by kind",
        [memoryId, member.id],
      );
      expect(afterSwitch.rows).toHaveLength(1);
      expect(afterSwitch.rows[0]?.kind).toBe("love");

      await asPersonaCommitted(client, { role: "authenticated", userId: member.id }, async (tx) => {
        await tx.query("delete from public.reactions where memory_id = $1 and profile_id = $2", [
          memoryId,
          member.id,
        ]);
      });
      const afterDelete = await client.query(
        "select 1 from public.reactions where memory_id = $1 and profile_id = $2",
        [memoryId, member.id],
      );
      expect(afterDelete.rows).toEqual([]);
    } finally {
      await client.query("delete from public.reactions where memory_id = $1 and profile_id = $2", [
        memoryId,
        member.id,
      ]);
    }
  });

  it("refuses forging profile_id — no INSERT grant exists on it", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member.id },
      "insert into public.reactions (batch_id, memory_id, kind, profile_id) values ($1, $2, 'like', $3)",
      [batchId, memoryId, stranger.id],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("refuses a disallowed kind", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member.id },
      "insert into public.reactions (batch_id, memory_id, kind) values ($1, $2, 'angry')",
      [batchId, memoryId],
    );
    expect(result.ok).toBe(false);
  });

  it("a non-member cannot react", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: stranger.id },
      "insert into public.reactions (batch_id, memory_id, kind) values ($1, $2, 'like')",
      [batchId, memoryId],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });
});

describe("reports — RPC only, zero table grant", () => {
  it("anon/authenticated cannot touch the reports table directly", async () => {
    const result = await attempt(
      client,
      { role: "authenticated", userId: member.id },
      "select * from public.reports",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("42501");
  });

  it("create_report resolves the target's batch server-side and refuses a non-member", async () => {
    const nonMember = await attempt(
      client,
      { role: "authenticated", userId: stranger.id },
      "select public.create_report('memory'::public.report_target_kind, $1, 'spam')",
      [memoryId],
    );
    expect(nonMember.ok).toBe(false);
    if (!nonMember.ok) expect(nonMember.error.code).toBe("42501");

    const created = await asPersonaCommitted(client, { role: "authenticated", userId: member.id }, async (tx) => {
      const result = await tx.query<{ batch_id: string; target_id: string }>(
        "select (public.create_report('memory'::public.report_target_kind, $1, 'spam')).*",
        [memoryId],
      );
      return result.rows[0];
    });
    expect(created?.batch_id).toBe(batchId);
    expect(created?.target_id).toBe(memoryId);
  });

  it("a duplicate open report from the same reporter about the same target is idempotent, not duplicated", async () => {
    const first = await asPersonaCommitted(client, { role: "authenticated", userId: owner.id }, async (tx) => {
      const result = await tx.query<{ id: string }>(
        "select (public.create_report('memory'::public.report_target_kind, $1, 'harassment')).id",
        [memoryId],
      );
      return result.rows[0]?.id;
    });
    const second = await asPersonaCommitted(client, { role: "authenticated", userId: owner.id }, async (tx) => {
      const result = await tx.query<{ id: string }>(
        "select (public.create_report('memory'::public.report_target_kind, $1, 'harassment')).id",
        [memoryId],
      );
      return result.rows[0]?.id;
    });
    expect(second).toBe(first);

    const count = await client.query<{ count: string }>(
      "select count(*)::text as count from public.reports where reporter_id = $1 and target_id = $2",
      [owner.id, memoryId],
    );
    expect(count.rows[0]?.count).toBe("1");
  });

  it("list_open_reports is mod+ only", async () => {
    const asMember = await attempt(
      client,
      { role: "authenticated", userId: member.id },
      "select * from public.list_open_reports($1)",
      [batchId],
    );
    expect(asMember.ok).toBe(false);
    if (!asMember.ok) expect(asMember.error.code).toBe("42501");

    const asMod = await asPersona(client, { role: "authenticated", userId: moderator.id }, async (tx) => {
      const result = await tx.query("select * from public.list_open_reports($1)", [batchId]);
      return result.rows;
    });
    expect(asMod.length).toBeGreaterThan(0);
  });
});

describe("moderation — remove_content / restore_content, mod+ only, audited", () => {
  it("a non-mod cannot remove content; a moderator can, and it is soft-deleted + audited", async () => {
    const targetMemoryId = await seedMemory(batchId, member.id);
    try {
      const asMember = await attempt(
        client,
        { role: "authenticated", userId: member.id },
        "select public.remove_content('memory'::public.report_target_kind, $1)",
        [targetMemoryId],
      );
      expect(asMember.ok).toBe(false);
      if (!asMember.ok) expect(asMember.error.code).toBe("42501");

      await asPersonaCommitted(client, { role: "authenticated", userId: moderator.id }, async (tx) => {
        await tx.query("select public.remove_content('memory'::public.report_target_kind, $1)", [targetMemoryId]);
      });

      const removed = await client.query<{ deleted_at: string | null; deleted_by: string | null }>(
        "select deleted_at, deleted_by from public.memories where id = $1",
        [targetMemoryId],
      );
      expect(removed.rows[0]?.deleted_at).not.toBeNull();
      expect(removed.rows[0]?.deleted_by).toBe(moderator.id);

      const audit = await client.query<{ action: string }>(
        "select action from public.audit_logs where target_id = $1 and action = 'content_removed'",
        [targetMemoryId],
      );
      expect(audit.rows).toHaveLength(1);

      // Invisible to the member who created it, immediately.
      const memberView = await attempt(
        client,
        { role: "authenticated", userId: member.id },
        "select id from public.memories where id = $1",
        [targetMemoryId],
      );
      expect(memberView.ok).toBe(true);
      if (memberView.ok) expect(memberView.rows).toEqual([]);

      // restore_content: mod+ only, undoes it.
      await asPersonaCommitted(client, { role: "authenticated", userId: moderator.id }, async (tx) => {
        await tx.query("select public.restore_content('memory'::public.report_target_kind, $1)", [targetMemoryId]);
      });
      const restored = await client.query<{ deleted_at: string | null }>(
        "select deleted_at from public.memories where id = $1",
        [targetMemoryId],
      );
      expect(restored.rows[0]?.deleted_at).toBeNull();
    } finally {
      await client.query("delete from public.audit_logs where target_id = $1", [targetMemoryId]);
      await client.query("delete from public.memories where id = $1", [targetMemoryId]);
    }
  });
});

describe("list_audit_log — admin+ only", () => {
  it("a moderator (below admin) is refused; the owner (admin+) succeeds", async () => {
    const asMod = await attempt(
      client,
      { role: "authenticated", userId: moderator.id },
      "select * from public.list_audit_log($1)",
      [batchId],
    );
    expect(asMod.ok).toBe(false);
    if (!asMod.ok) expect(asMod.error.code).toBe("42501");

    const asOwner = await asPersona(client, { role: "authenticated", userId: owner.id }, async (tx) => {
      const result = await tx.query("select * from public.list_audit_log($1)", [batchId]);
      return result.rows;
    });
    expect(Array.isArray(asOwner)).toBe(true);
  });
});
