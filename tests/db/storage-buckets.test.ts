import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect, supabaseAnonKey, supabaseApiUrl } from "./support/db";

/**
 * The two foundation Storage buckets, verified against a real Supabase
 * environment: private, deny-by-default, and not anonymously readable
 * (architecture §7; security.md §6, §7; phases.md Phase 0).
 *
 * This file requires Supabase specifically — a bare PostgreSQL server has no
 * `storage` schema. It fails with that explanation rather than skipping,
 * because a storage-privacy check that silently does nothing would report a
 * guarantee nobody verified.
 */

let client: Client;

beforeAll(async () => {
  client = await connect();
  const { rows } = await client.query<{ present: boolean }>(
    "select to_regclass('storage.buckets') is not null as present",
  );
  if (rows[0]?.present !== true) {
    throw new Error(
      "storage.buckets is absent: these checks require a Supabase environment " +
        "(`pnpm db:start`), not a bare PostgreSQL server.",
    );
  }
});

afterAll(async () => {
  if (client !== undefined) {
    await client.end();
  }
});

describe("foundation Storage buckets", () => {
  it("creates exactly the two MVP buckets, and not the future showcase bucket", async () => {
    const { rows } = await client.query<{ id: string }>(
      "select id from storage.buckets order by id",
    );
    const ids = rows.map((row) => row.id);

    expect(ids).toContain("avatars");
    expect(ids).toContain("batch-media");
    expect(ids).not.toContain("showcase");
  });

  it("has no public bucket, anywhere", async () => {
    const { rows } = await client.query<{ id: string }>(
      "select id from storage.buckets where public is true",
    );
    expect(rows.map((row) => row.id)).toEqual([]);
  });

  it("adds only the Phase 1+2 avatar policies, and nothing for batch-media", async () => {
    const { rows } = await client.query<{ policyname: string; qual: string | null }>(
      `select policyname, qual::text as qual from pg_policies
        where schemaname = 'storage' and tablename = 'objects'`,
    );
    const names = rows.map((row) => row.policyname).sort();

    // Deny-by-default remains correct for batch-media: those policies arrive
    // with the flow they protect in Phase 4A, not before.
    // `avatars_select_shared_batch` is Phase 2's additive co-member read
    // policy (security.md §6.1) — it OR-combines with `avatars_select_own`,
    // which is unchanged.
    expect(names).toEqual(
      [
        "avatars_delete_own",
        "avatars_insert_own",
        "avatars_select_own",
        "avatars_select_shared_batch",
        "avatars_update_own",
      ].sort(),
    );
    expect(rows.every((row) => !(row.qual ?? "").includes("batch-media"))).toBe(
      true,
    );
  });

  it("keeps row level security enabled on storage.objects", async () => {
    const { rows } = await client.query<{ relrowsecurity: boolean }>(
      `select c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'storage' and c.relname = 'objects'`,
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});

describe("anonymous Storage access", () => {
  it("refuses the public object endpoint for both buckets", async () => {
    const apiUrl = supabaseApiUrl();

    for (const bucket of ["batch-media", "avatars"]) {
      const response = await fetch(
        `${apiUrl}/storage/v1/object/public/${bucket}/probe.bin`,
      );
      expect(response.status, `${bucket} public endpoint`).not.toBe(200);
    }
  });

  it("lists nothing for an anonymous caller", async () => {
    const apiUrl = supabaseApiUrl();
    const anonKey = supabaseAnonKey();

    for (const bucket of ["batch-media", "avatars"]) {
      const response = await fetch(
        `${apiUrl}/storage/v1/object/list/${bucket}`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefix: "", limit: 10 }),
        },
      );

      if (response.ok) {
        const listed: unknown = await response.json();
        expect(listed, `${bucket} listed objects anonymously`).toEqual([]);
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    }
  });
});
