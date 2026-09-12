import type { Client } from "pg";

import { assertSafeIdentifier } from "./db";

/**
 * Describes the database the B2 experiment is actually running against, so
 * the recorded result can never overstate what was proven.
 *
 * `kind: "supabase"` means a real Supabase environment was detected: the
 * `auth` schema, `auth.uid()` and the `anon`/`authenticated`/`service_role`
 * roles already exist and were created by Supabase itself.
 *
 * `kind: "reconstructed"` means a plain PostgreSQL server with the Supabase
 * role model rebuilt by this harness. PostgreSQL's own semantics (FORCE RLS,
 * SECURITY DEFINER, BYPASSRLS, ownership) are proven exactly as they behave in
 * production, but the *role attributes* are this harness's reconstruction, not
 * Supabase's. Any finding that depends on which Supabase role holds which
 * attribute must be re-confirmed against a real Supabase instance.
 */
export interface TargetEnvironment {
  kind: "supabase" | "reconstructed";
  /** The role that owns migrated objects: `postgres` on Supabase. */
  ownerRole: string;
  serverVersion: string;
  roleAttributes: RoleAttributes[];
}

export interface RoleAttributes {
  role: string;
  superuser: boolean;
  bypassrls: boolean;
  canLogin: boolean;
}

const SUPABASE_OWNER_ROLE = "postgres";
const RECONSTRUCTED_OWNER_ROLE = "bv_migration_owner";

export async function prepareTargetEnvironment(
  client: Client,
): Promise<TargetEnvironment> {
  const { rows: versionRows } = await client.query<{ version: string }>(
    "select version() as version",
  );
  const serverVersion = versionRows[0]?.version ?? "unknown";

  const isSupabase = await detectSupabase(client);
  if (!isSupabase) {
    await bootstrapReconstructedRoleModel(client);
  }

  const ownerRole = isSupabase
    ? SUPABASE_OWNER_ROLE
    : RECONSTRUCTED_OWNER_ROLE;

  return {
    kind: isSupabase ? "supabase" : "reconstructed",
    ownerRole,
    serverVersion,
    roleAttributes: await readRoleAttributes(client, [
      ownerRole,
      "anon",
      "authenticated",
      "service_role",
    ]),
  };
}

/**
 * Detects a genuine Supabase environment by objects only Supabase creates.
 * `auth.uid()` alone is not a signal, because this harness's own
 * reconstruction defines it — treating that as Supabase would silently
 * upgrade a reconstructed result into a claim about the real thing.
 */
async function detectSupabase(client: Client): Promise<boolean> {
  const { rows } = await client.query<{ present: boolean }>(
    `select (
       to_regclass('auth.users') is not null
       and exists (select 1 from pg_roles where rolname = 'supabase_admin')
       and exists (select 1 from pg_roles where rolname = 'authenticator')
       and to_regprocedure('auth.uid()') is not null
     ) as present`,
  );
  return rows[0]?.present === true;
}

export async function readRoleAttributes(
  client: Client,
  roles: string[],
): Promise<RoleAttributes[]> {
  const { rows } = await client.query<{
    rolname: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
  }>(
    `select rolname, rolsuper, rolbypassrls, rolcanlogin
       from pg_roles
      where rolname = any($1::text[])
      order by rolname`,
    [roles],
  );

  return rows.map((row) => ({
    role: row.rolname,
    superuser: row.rolsuper,
    bypassrls: row.rolbypassrls,
    canLogin: row.rolcanlogin,
  }));
}

/**
 * Rebuilds Supabase's role model on a plain PostgreSQL server:
 *
 *  - `anon`, `authenticated`  — client roles, no RLS exemption;
 *  - `service_role`           — BYPASSRLS, which is what makes the service-role
 *                               key bypass every policy (security.md §12);
 *  - a non-superuser migration/owner role standing in for Supabase's
 *    `postgres`, deliberately WITHOUT superuser and WITHOUT BYPASSRLS, because
 *    a superuser owner would make the FORCE RLS question untestable;
 *  - `auth.uid()` / `auth.role()` reading the same `request.jwt.claims` GUC
 *    PostgREST sets.
 */
async function bootstrapReconstructedRoleModel(client: Client): Promise<void> {
  const owner = assertSafeIdentifier(RECONSTRUCTED_OWNER_ROLE);

  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin noinherit bypassrls;
      end if;
      if not exists (select 1 from pg_roles where rolname = '${owner}') then
        create role ${owner} nologin noinherit nosuperuser nobypassrls createrole;
      end if;
    end
    $$;
  `);

  await client.query(
    `grant anon, authenticated, service_role, ${owner} to current_user with admin option`,
  );

  await client.query("create schema if not exists auth");
  await client.query(
    `grant usage on schema auth to anon, authenticated, service_role, ${owner}`,
  );

  // Mirrors Supabase's own definitions: identity comes from the request's JWT
  // claims, not from the database session's role.
  await client.query(`
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(
        coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        ),
        ''
      )::uuid
    $$;
  `);

  await client.query(`
    create or replace function auth.role()
    returns text
    language sql
    stable
    as $$
      select nullif(
        coalesce(
          nullif(current_setting('request.jwt.claim.role', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
        ),
        ''
      )::text
    $$;
  `);

  // Supabase exposes these to every role; policies and privileged functions
  // alike depend on them.
  await client.query(
    "grant execute on function auth.uid(), auth.role() to public",
  );
}
