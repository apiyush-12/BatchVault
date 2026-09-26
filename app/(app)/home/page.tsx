import Link from "next/link";
import { Archive, Plus } from "lucide-react";

import { SignOutButton } from "@/features/authentication/components/sign-out-button";
import { listMyBatches } from "@/features/batches/queries";
import { getOwnProfile } from "@/features/profiles/queries";

export const metadata = { title: "BatchVault" };

/**
 * The batch switcher (phases.md Phase 2; PRD §16; design.md §15) — the
 * lightweight way to move between the batches a user belongs to. Each batch
 * card links into that batch's own scoped surface; there is no cross-batch
 * feed here (design.md §15).
 */
export default async function HomePage() {
  const [profile, myBatches] = await Promise.all([getOwnProfile(), listMyBatches()]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-10 px-5 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-heading-sm font-semibold">
          <Archive aria-hidden="true" className="size-5 text-primary" />
          BatchVault
        </span>
        <SignOutButton />
      </header>

      <main id="main" className="flex flex-1 flex-col gap-6">
        <h1 className="text-heading-lg font-semibold">
          {profile !== null ? `Hey, ${profile.displayName}` : "You're in"}.
        </h1>

        {myBatches.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
            <p className="max-w-prose text-body text-foreground-muted">
              You&rsquo;re not part of a batch yet. Create one to start
              building your batch&rsquo;s shared archive.
            </p>
            <Link
              href="/batches/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground shadow-raised hover:bg-primary-hover"
            >
              <Plus aria-hidden="true" className="size-4" />
              Create your batch
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {myBatches.map(({ batch, role }) => (
                <li key={batch.id}>
                  <Link
                    href={`/batches/${batch.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-sunken"
                  >
                    <span className="text-body font-semibold text-foreground">
                      {batch.name}
                    </span>
                    <span className="text-body-sm text-foreground-muted">
                      {batch.institutionName}
                      {batch.graduationYear !== null ? ` · ${batch.graduationYear}` : ""}
                      {" · "}
                      {role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/batches/new"
              className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-surface px-4 py-2 text-body-sm font-medium text-foreground hover:bg-surface-sunken"
            >
              <Plus aria-hidden="true" className="size-4" />
              Create another batch
            </Link>
          </div>
        )}

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
