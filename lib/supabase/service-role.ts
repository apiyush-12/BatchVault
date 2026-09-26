import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — the single module holding system authority
 * (architecture §6, ADR-09; security.md §12).
 *
 * This credential bypasses RLS entirely. Exposure is not a degradation, it is
 * total loss of every privacy guarantee in the product, so:
 *
 * - `server-only` makes an import from browser-reachable code a build error;
 * - the credential is never `NEXT_PUBLIC_` (enforced in lib/env);
 * - "privileged" is never a reason to reach for this. A user-initiated
 *   privileged action (role change, removal, ownership transfer, moderation)
 *   runs user-scoped against a narrow privileged RPC that authorizes
 *   `auth.uid()` — using this client there would discard the caller's identity
 *   at the database boundary (security.md §12).
 *
 * Legitimate call sites are an enumerated, reviewed list (security.md §12):
 *   1. Supabase Auth admin operations that cannot be performed as the user
 *      (notably account deletion).
 *   2. Bounded cron/cleanup jobs acting across batches with no user present.
 *   3. Operational backup/export/recovery tooling run outside the request path.
 *
 * As of Phase 0 there are no call sites at all. Adding one is a reviewed
 * change, not a convenience.
 */
export function createSupabaseServiceRoleClient() {
  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
