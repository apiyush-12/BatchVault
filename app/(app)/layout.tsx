import { redirect } from "next/navigation";

import { hasCompletedOnboarding } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side route protection for the authenticated surface (architecture
 * §4: "Protected route groups are guarded server-side (redirect to
 * sign-in), not by hiding UI"). Onboarding gates access, per PRD §9.2 — a
 * signed-in but not-yet-onboarded user is routed to finish it first.
 *
 * This is a real check, not the guarantee: RLS is what actually enforces
 * data access (architecture §5) — this layout only decides what the UI shows.
 */
export default async function AppLayout({
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
  if (!onboarded) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
