import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect } from "./support/db";

/**
 * The Phase 0 migrations, verified by running them and observing the result
 * rather than by reading them.
 *
 * Scope is exactly what Phase 0 creates: the shared `set_updated_at()`
 * housekeeping function (database.md §11). No application table exists yet,
 * and this file must not create one.
 */

const MIGRATION = path.join(
  "supabase",
  "migrations",
  "20260912120000_foundation_set_updated_at.sql",
);

const PROBE_SCHEMA = "foundation_probe";

let client: Client;

beforeAll(async () => {
  client = await connect();
  await client.query(await readFile(MIGRATION, "utf8"));
  await client.query(`drop schema if exists ${PROBE_SCHEMA} cascade`);
  await client.query(`create schema ${PROBE_SCHEMA}`);
  await client.query(`
    create table ${PROBE_SCHEMA}.mutable_row (
      id uuid primary key default gen_random_uuid(),
      label text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create trigger set_updated_at
      before update on ${PROBE_SCHEMA}.mutable_row
      for each row execute function public.set_updated_at();
  `);
});

afterAll(async () => {
  if (client !== undefined) {
    await client.query(`drop schema if exists ${PROBE_SCHEMA} cascade`);
    await client.end();
  }
});

describe("set_updated_at()", () => {
  it("exists with the pinned, non-dynamic configuration the rules require", async () => {
    const { rows } = await client.query<{
      security_definer: boolean;
      config: string[] | null;
      language: string;
    }>(
      `select p.prosecdef as security_definer,
              p.proconfig as config,
              l.lanname as language
         from pg_proc p
         join pg_language l on l.oid = p.prolang
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'set_updated_at'`,
    );

    expect(rows).toHaveLength(1);
    // Housekeeping runs as the invoker; it needs no elevated rights.
    expect(rows[0]?.security_definer).toBe(false);
    // Pinned to an empty search_path, so no caller-controlled schema can
    // shadow anything it references (security.md §28).
    expect(rows[0]?.config).toContain('search_path=""');
    expect(rows[0]?.language).toBe("plpgsql");
  });

  it("maintains updated_at on update, and leaves created_at alone", async () => {
    await client.query(
      `insert into ${PROBE_SCHEMA}.mutable_row (label, created_at, updated_at)
       values ('before', now() - interval '1 day', now() - interval '1 day')`,
    );

    const { rows: before } = await client.query<{
      created_at: Date;
      updated_at: Date;
    }>(`select created_at, updated_at from ${PROBE_SCHEMA}.mutable_row`);

    await client.query(
      `update ${PROBE_SCHEMA}.mutable_row set label = 'after'`,
    );

    const { rows: after } = await client.query<{
      label: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `select label, created_at, updated_at from ${PROBE_SCHEMA}.mutable_row`,
    );

    expect(after[0]?.label).toBe("after");
    expect(after[0]?.created_at.getTime()).toBe(
      before[0]?.created_at.getTime(),
    );
    expect(after[0]?.updated_at.getTime()).toBeGreaterThan(
      before[0]?.updated_at.getTime() ?? 0,
    );
  });

  it("ignores a caller-supplied updated_at", async () => {
    await client.query(`truncate ${PROBE_SCHEMA}.mutable_row`);
    await client.query(
      `insert into ${PROBE_SCHEMA}.mutable_row (label) values ('seed')`,
    );

    await client.query(
      `update ${PROBE_SCHEMA}.mutable_row
          set label = 'forged', updated_at = timestamptz '2001-01-01 00:00:00Z'`,
    );

    const { rows } = await client.query<{ updated_at: Date }>(
      `select updated_at from ${PROBE_SCHEMA}.mutable_row`,
    );

    expect(rows[0]?.updated_at.getFullYear()).toBeGreaterThan(2001);
  });

  it("grants no EXECUTE to client roles", async () => {
    const { rows } = await client.query<{ acl: string | null }>(
      `select array_to_string(p.proacl, ',') as acl
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'set_updated_at'`,
    );

    const acl = rows[0]?.acl ?? "";
    expect(acl).not.toMatch(/(^|,)=X\//); // no PUBLIC execute
    expect(acl).not.toContain("anon=");
    expect(acl).not.toContain("authenticated=");
  });
});

describe("Phase 0 schema scope", () => {
  it("creates no BatchVault application table beyond what the current phase authorizes", async () => {
    // `profiles` (Phase 1), `batches` / `batch_members` / `audit_logs`
    // (Phase 2), and `batch_invites` / `invite_redemption_attempts` (Phase
    // 3A, phases.md) are deliberately excluded from this list — exactly
    // like `profiles` was excluded once Phase 1 created it.
    // `invite_redemption_attempts` is implementation-only bookkeeping for
    // security.md §17's rate-limit requirement, not a `database.md` MVP
    // table, but it is real schema this phase legitimately creates, so it
    // is excluded here for the same reason. Every remaining MVP table stays
    // Phase 3B+, and every post-MVP table stays uncreated.
    const { rows } = await client.query<{ tablename: string }>(
      `select tablename
         from pg_tables
        where schemaname = 'public'
          and tablename = any($1::text[])`,
      [
        [
          "memories",
          "media_assets",
          "comments",
          "reactions",
          "reports",
          "albums",
          "album_memories",
          "notifications",
          "time_capsules",
          "time_capsule_entries",
          "yearbook_entries",
        ],
      ],
    );

    expect(rows.map((row) => row.tablename)).toEqual([]);
  });
});
