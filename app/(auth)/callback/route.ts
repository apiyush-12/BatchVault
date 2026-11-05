import { NextResponse } from "next/server";

import { resolveAllowedRedirect } from "@/features/authentication/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Auth callback (architecture §16, "NO token in the path" note applies to
 * invites; this route exists for Supabase Auth's own PKCE code exchange).
 *
 * Order per architecture §18.9: this route has no body to authenticate
 * against, so validation is simply "is `code` present" before anything else
 * runs. The redirect target is allowlisted (security.md §13) — an open
 * redirect on an auth flow is a phishing primitive, so an unrecognized `next`
 * value is never trusted, only replaced with the safe default.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = resolveAllowedRedirect(url.searchParams.get("next"));

  // A fixed, non-sensitive flag the sign-in page turns into a visible
  // explanation, rather than dropping the user there with no context.
  const failed = new URL("/sign-in?link=invalid", url.origin);

  if (code === null) {
    return NextResponse.redirect(failed);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    return NextResponse.redirect(failed);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
