import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env/client";

/**
 * Browser, user-scoped Supabase client (architecture §6).
 *
 * Carries the anon/publishable credential plus the user's session, so every
 * request it makes is constrained by RLS. It holds no privilege of its own.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
