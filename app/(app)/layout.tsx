import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { listMyBatches } from "@/features/batches/queries";
import { getOwnAvatarUrl, getOwnProfile } from "@/features/profiles/queries";
import { getVerifiedUser, hasCompletedOnboarding } from "@/lib/auth/session";

/**
 * Server-side route protection for the authenticated surface (architecture
 * §4: "Protected route groups are guarded server-side (redirect to
 * sign-in), not by hiding UI"). Onboarding gates access, per PRD §9.2 — a
 * signed-in but not-yet-onboarded user is routed to finish it first.
 *
 * This is a real check, not the guarantee: RLS is what actually enforces
 * data access (architecture §5) — this layout only decides what the UI shows.
 *
 * Once the guard passes, the layout renders the shared application shell:
 * the user's own profile and the batches they belong to feed the navigation.
 * Both come from the same RLS-scoped queries the pages already use.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getVerifiedUser();

  if (user === null) {
    redirect("/sign-in");
  }

  const onboarded = await hasCompletedOnboarding(user.id);
  if (!onboarded) {
    redirect("/onboarding");
  }

  const [profile, avatarUrl, myBatches] = await Promise.all([
    getOwnProfile(),
    getOwnAvatarUrl(),
    listMyBatches(),
  ]);

  return (
    <AppShell
      displayName={profile?.displayName ?? null}
      avatarUrl={avatarUrl}
      batches={myBatches.map(({ batch }) => ({
        id: batch.id,
        name: batch.name,
        institutionName: batch.institutionName,
        graduationYear: batch.graduationYear,
      }))}
    >
      {children}
    </AppShell>
  );
}
