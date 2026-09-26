import { redirect } from "next/navigation";

import { hasCompletedOnboarding } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Route protection for the auth surface (architecture §4): a signed-in user
 * has no reason to see sign-in/sign-up, so they are routed to wherever they
 * actually belong instead. This is a Server Component check, not middleware
 * (rules.md §1.2) — never hiding a nav link and hoping.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user !== null) {
    const onboarded = await hasCompletedOnboarding(data.user.id);
    redirect(onboarded ? "/home" : "/onboarding");
  }

  return <>{children}</>;
}
