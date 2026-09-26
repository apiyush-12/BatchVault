import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseApiUrl, supabaseServiceRoleKey } from "../../db/support/db";

/**
 * Disposable, pre-confirmed users for the Playwright flow (testing.md §7).
 *
 * The "verify" step's actual email-link mechanics are not automatable here
 * without a real inbox; this fixture simulates having already verified
 * (`email_confirm: true` via the Admin API, one of the enumerated legitimate
 * service-role call sites, security.md §12) so the E2E can exercise the
 * parts that genuinely need a browser: onboarding, the protected route,
 * and sign-out.
 */
export interface E2eUser {
  id: string;
  email: string;
  password: string;
}

export async function createConfirmedUser(): Promise<E2eUser> {
  const client = createClient(supabaseApiUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `bv-e2e-${randomUUID()}@bv-e2e-test.dev`;
  const password = `Test-${randomUUID()}!`;

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error !== null || data.user === null) {
    throw new Error(`failed to create disposable E2E user: ${error?.message}`);
  }

  return { id: data.user.id, email, password };
}

export async function deleteUser(userId: string): Promise<void> {
  const client = createClient(supabaseApiUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.auth.admin.deleteUser(userId);
}

export { supabaseAnonKey };
