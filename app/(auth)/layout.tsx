import { redirect } from "next/navigation";

import { getVerifiedUser, hasCompletedOnboarding } from "@/lib/auth/session";

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
  const user = await getVerifiedUser();

  if (user !== null) {
    const onboarded = await hasCompletedOnboarding(user.id);
    redirect(onboarded ? "/home" : "/onboarding");
  }

  return <>{children}</>;
}
