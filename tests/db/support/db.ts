import { existsSync, readFileSync } from "node:fs";

import { Client } from "pg";

/**
 * Direct-SQL harness for the database-level tests (testing.md §2.3).
 *
 * Tests at this level impersonate a real persona and call the database
 * directly, because a test that only calls the application proves nothing
 * about the boundary. Personas are established the way PostgREST establishes
 * them: the JWT claims are placed in `request.jwt.claims` (which is what
 * `auth.uid()` reads) and the session role is switched to `anon`,
 * `authenticated` or `service_role`.
 *
 * Every helper runs inside a transaction that is rolled back, so no test
 * depends on another test's leftover state.
 */

export const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** The Supabase CLI stack's API URL, used only when nothing is configured. */
const LOCAL_API_URL = "http://127.0.0.1:54321";

let localEnvLoaded = false;

/**
 * Fills in any process.env value missing from the repository's git-ignored
 * `.env.local`. Vitest does not read that file itself, and these tests
 * deliberately use the **same variable names the application uses**
 * (architecture §15) rather than inventing a second convention of their own.
 *
 * Variables already present in the environment always win, so CI — which
 * exports them directly from `supabase status` — is unaffected.
 */
function loadLocalEnv(): void {
  if (localEnvLoaded) {
    return;
  }
  localEnvLoaded = true;

  if (!existsSync(".env.local")) {
    return;
  }

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    const key = match?.[1];
    const rawValue = match?.[2];
    if (key === undefined || rawValue === undefined) {
      continue;
    }
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

export function databaseUrl(): string {
  loadLocalEnv();
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

function targetsLocalStack(url: string): boolean {
  return url.includes("127.0.0.1") || url.includes("localhost");
}

/**
 * The Supabase API origin the HTTP-level checks should talk to — the linked
 * project when one is configured, the local CLI stack otherwise.
 *
 * When `DATABASE_URL` points at a remote database but no API URL is
 * configured, this **throws rather than falling back to localhost**: silently
 * probing a local stack that may not even be running would report Storage
 * privacy for a project nobody tested.
 */
export function supabaseApiUrl(): string {
  loadLocalEnv();

  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configured !== undefined && configured !== "") {
    return configured.replace(/\/+$/, "");
  }

  if (targetsLocalStack(databaseUrl())) {
    return LOCAL_API_URL;
  }

  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is required: DATABASE_URL points at a remote " +
      "database, so defaulting to the local API URL would verify the wrong " +
      "project. Set it in .env.local or the environment.",
  );
}

/** The anon/publishable client credential, under the documented name. */
export function supabaseAnonKey(): string {
  loadLocalEnv();

  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key === undefined || key === "") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for the anonymous Storage " +
        "checks. Set it in .env.local or the environment.",
    );
  }
  return key;
}

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  return client;
}

/** A PostgREST-style caller: a session role, and optionally a user id. */
export interface Persona {
  role: "anon" | "authenticated" | "service_role";
  userId?: string;
}

export interface SqlError {
  code: string | undefined;
  message: string;
}

export type SqlResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: SqlError };

/**
 * Runs `work` inside a rolled-back transaction with the given persona active.
 * The claims GUC is set before the role switch so the switch itself never
 * depends on a client role's ability to set configuration.
 */
export async function asPersona<T>(
  client: Client,
  persona: Persona,
  work: (tx: Client) => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    const claims =
      persona.userId === undefined
        ? JSON.stringify({ role: persona.role })
        : JSON.stringify({ sub: persona.userId, role: persona.role });
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      claims,
    ]);
    await client.query(`set local role ${persona.role}`);
    return await work(client);
  } finally {
    await client.query("rollback");
  }
}

/** Runs a statement as a persona and reports success or the database's error. */
export async function attempt<T extends Record<string, unknown>>(
  client: Client,
  persona: Persona,
  sql: string,
  params: unknown[] = [],
): Promise<SqlResult<T>> {
  return asPersona(client, persona, async (tx) => {
    try {
      const result = await tx.query<T>(sql, params);
      return { ok: true as const, rows: result.rows };
    } catch (error) {
      return { ok: false as const, error: toSqlError(error) };
    }
  });
}

/**
 * Runs `work` as a named database role inside a rolled-back transaction. Used
 * for the migration/owner role, which is not a PostgREST persona.
 */
export async function asRole<T>(
  client: Client,
  role: string,
  work: (tx: Client) => Promise<T>,
): Promise<T> {
  const safeRole = assertSafeIdentifier(role);
  await client.query("begin");
  try {
    await client.query(`set local role ${safeRole}`);
    return await work(client);
  } finally {
    await client.query("rollback");
  }
}

/** Runs a statement as a named role and reports success or the error. */
export async function attemptAsRole<T extends Record<string, unknown>>(
  client: Client,
  role: string,
  sql: string,
  params: unknown[] = [],
): Promise<SqlResult<T>> {
  return asRole(client, role, async (tx) => {
    try {
      const result = await tx.query<T>(sql, params);
      return { ok: true as const, rows: result.rows };
    } catch (error) {
      return { ok: false as const, error: toSqlError(error) };
    }
  });
}

export function toSqlError(error: unknown): SqlError {
  if (typeof error === "object" && error !== null && "message" in error) {
    const candidate = error as { message: unknown; code?: unknown };
    return {
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      message: String(candidate.message),
    };
  }
  return { code: undefined, message: String(error) };
}

/**
 * Identifiers are never interpolated from external input. These come from
 * this repository's own fixtures, and are validated anyway so a typo cannot
 * become a SQL-injection shaped mistake (security.md §28).
 */
export function assertSafeIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return identifier;
}
