import Link from "next/link";
import { Archive } from "lucide-react";

import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import { getOwnProfile } from "@/features/profiles/queries";

export const metadata = { title: "BatchVault" };

/**
 * Minimal authenticated placeholder (phases.md Phase 1: "reach protected
 * routes"). Deliberately not a dashboard, and not batch creation — that is
 * Phase 2.
 */
export default async function HomePage() {
  const profile = await getOwnProfile();

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-10 px-5 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-heading-sm font-semibold">
          <Archive aria-hidden="true" className="size-5 text-primary" />
          BatchVault
        </span>
        <SignOutButton />
      </header>

      <main id="main" className="flex flex-1 flex-col justify-center gap-4">
        <h1 className="text-heading-lg font-semibold">
          You&rsquo;re in{profile !== null ? `, ${profile.displayName}` : ""}.
        </h1>
        <p className="max-w-prose text-body text-foreground-muted">
          Your account and profile are set up. Batches, invites and memories
          arrive in the next phases.
        </p>
        <p>
          <Link
            href="/settings"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Account settings
          </Link>
        </p>
      </main>
    </div>
  );
}
