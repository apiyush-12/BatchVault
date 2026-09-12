import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env/client";

/**
 * Server, user-scoped Supabase client (architecture §4, §6).
 *
 * Bound to the request's cookies, so Server Components and Server Actions act
 * as the signed-in user and every statement they issue is evaluated against
 * that user's RLS policies. This is the default client on the server; the
 * service-role client is the reviewed exception, never the convenience.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session instead (architecture §4).
          }
        },
      },
    },
  );
}
