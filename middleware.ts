import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database";

/**
 * Session-refresh middleware (architecture §4; rules.md §1.2).
 *
 * This is the ONLY thing this file does. It refreshes the Supabase session
 * cookie on every request so Server Components/Actions read a current
 * session; it performs no redirects and no business logic. Route protection
 * (redirecting an unauthenticated visitor, gating onboarding) lives in each
 * protected route group's `layout.tsx` as a Server Component, not here
 * ("middleware... does nothing else; it is not a place for business logic").
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Triggers a token refresh when the access token is expired, which is what
  // makes the refreshed cookie get written back via setAll above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Every route except static assets and image optimization files, so a
     * new route is protected by default rather than by remembering to add
     * it here.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
