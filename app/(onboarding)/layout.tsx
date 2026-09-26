import { redirect } from "next/navigation";

import { hasCompletedOnboarding } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side route protection for the onboarding group (architecture §4,
 * §18.3). An unauthenticated visitor is sent to sign in; a user who has
 * already onboarded has nothing to do here and is sent to their home.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user === null) {
    redirect("/sign-in");
  }

  const onboarded = await hasCompletedOnboarding(data.user.id);
  if (onboarded) {
    redirect("/home");
  }

  return <>{children}</>;
}
