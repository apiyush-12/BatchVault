import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database";

/**
 * Browser, user-scoped Supabase client (architecture §6).
 *
 * Carries the anon/publishable credential plus the user's session, so every
 * request it makes is constrained by RLS. It holds no privilege of its own.
 *
 * Typed against the generated schema (rules.md §1.1) — a hand-maintained
 * duplicate of a table shape is not permitted once generation exists.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
