import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Session helpers (architecture §16, §18.4).
 *
 * The one rule every caller of this module depends on: the acting user comes
 * only from the verified session, never from a client-supplied id. This
 * module is the single place that reads `auth.getUser()` so every Server
 * Component/Action derives identity the same way.
 *
 * `getVerifiedUser` is memoized per server request with React `cache`: the
 * layout, the page and every query in one render share one Auth round trip
 * instead of each verifying the JWT again. The cache never outlives the
 * request, so identity is still re-verified on every navigation.
 */

/** The verified caller, or `null` if no session exists. */
export const getVerifiedUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error !== null) {
    return null;
  }
  return data.user;
});

/** True once the caller's own profile has completed onboarding. */
export const hasCompletedOnboarding = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  return data?.onboarding_completed_at !== null && data?.onboarding_completed_at !== undefined;
});
