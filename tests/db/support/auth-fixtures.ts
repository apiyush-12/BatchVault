import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseApiUrl, supabaseServiceRoleKey } from "./db";

/**
 * Disposable real Auth users for the Phase 1 adversarial suite.
 *
 * `profiles.id` carries a real `references auth.users(id)` foreign key, so a
 * synthetic UUID (as the B2 probes used) cannot be inserted into `profiles`
 * — the FK rejects it before RLS is even reached. These tests need a genuine
 * `auth.users` row per persona, created and torn down through the Auth Admin
 * API — one of the enumerated legitimate service-role call sites
 * (security.md §12) — never left behind (matching the B2 probe-hygiene
 * standard from Phase 0).
 */

let adminClient: SupabaseClient | null = null;

function admin(): SupabaseClient {
  adminClient ??= createClient(supabaseApiUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Creates one disposable, pre-confirmed test user. */
export async function createTestUser(): Promise<TestUser> {
  const email = `bv-test-${randomUUID()}@bv-e2e-test.dev`;
  const password = `Test-${randomUUID()}!`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error !== null || data.user === null) {
    throw new Error(`failed to create disposable test user: ${error?.message}`);
  }

  return { id: data.user.id, email, password };
}

/** A real access token for a disposable test user (HTTP-level checks, testing.md §3.6). */
export async function signInTestUser(user: TestUser): Promise<string> {
  const client = createClient(supabaseApiUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error !== null || data.session === null) {
    throw new Error(`failed to sign in disposable test user: ${error?.message}`);
  }
  return data.session.access_token;
}

/** Deletes a disposable test user; `profiles` cascades via its FK. */
export async function deleteTestUser(userId: string): Promise<void> {
  await admin().auth.admin.deleteUser(userId);
}

/**
 * Uploads bytes directly to Storage as the service role (bypasses RLS by
 * design — this is fixture setup, not something a client role could do),
 * so tests can assert against a real, known-existing object without
 * driving the whole controlled-upload flow just to reach the state under
 * test (testing.md §4, "known-state media fixtures").
 */
export async function seedAvatarObject(
  path: string,
  bytes: Uint8Array = new Uint8Array([1, 2, 3, 4]),
): Promise<void> {
  const { error } = await admin()
    .storage.from("avatars")
    .upload(path, bytes, { contentType: "application/octet-stream" });

  if (error !== null) {
    throw new Error(`failed to seed avatar object at ${path}: ${error.message}`);
  }
}

export async function deleteAvatarObject(path: string): Promise<void> {
  await admin().storage.from("avatars").remove([path]);
}

/** A real anon-key client, for the one HTTP-level Storage check this suite needs. */
export function anonStorageClient(): SupabaseClient {
  return createClient(supabaseApiUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
