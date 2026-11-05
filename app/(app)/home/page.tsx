import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { LocalGreeting } from "@/components/shell/local-greeting";
import { RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DeletedBatchesList } from "@/features/batches/components/deleted-batches-list";
import { listMyBatches, listMyDeletedBatches } from "@/features/batches/queries";
import { PendingInviteRedirect } from "@/features/invitations/components/pending-invite-redirect";
import { getOwnProfile } from "@/features/profiles/queries";

export const metadata = { title: "Home — BatchVault" };

/**
 * The batch switcher (phases.md Phase 2; PRD §16; design.md §15) — the
 * lightweight way to move between the batches a user belongs to. Each batch
 * card links into that batch's own scoped surface; there is no cross-batch
 * feed here (design.md §15).
 */
export default async function HomePage() {
  const [profile, myBatches, deletedBatches] = await Promise.all([
    getOwnProfile(),
    listMyBatches(),
    listMyDeletedBatches(),
  ]);

  const firstName = profile?.displayName.trim().split(/\s+/)[0] ?? null;

  return (
    <FadeIn className="flex flex-1 flex-col gap-10 pb-10">
      <PendingInviteRedirect />

      <PageHeader
        title={
          firstName !== null ? (
            <>
              <LocalGreeting />, {firstName}.
            </>
          ) : (
            "You're in."
          )
        }
        description={
          myBatches.length === 0
            ? "Create a batch for your classmates, or join one by opening the invite link someone sent you."
            : "Your batches, exactly where you left them."
        }
        actions={
          myBatches.length > 0 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/batches/new">
                <Plus aria-hidden="true" className="size-4" />
                Create another batch
              </Link>
            </Button>
          ) : undefined
        }
      />

      {myBatches.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="You're not part of a batch yet"
          description="Start your batch's shared archive, or join one a classmate already started. Every batch is private — only people with an invite can see it."
          action={
            <div className="flex flex-col items-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <Button asChild size="lg">
                  <Link href="/batches/new">
                    <Plus aria-hidden="true" className="size-4" />
                    Create your batch
                  </Link>
                </Button>
                <p className="text-caption text-foreground-muted">Starting a new batch? You&rsquo;ll be its owner.</p>
              </div>
              <div className="flex max-w-sm flex-col gap-1 border-t border-border pt-4">
                <p className="text-body-sm font-semibold text-foreground">Joining an existing batch?</p>
                <p className="text-body-sm text-foreground-muted">
                  Open the invite link a classmate sent you (in your messages or email). It brings you
                  straight in — there&rsquo;s nothing to paste here.
                </p>
              </div>
            </div>
          }
        />
      ) : (
        <section aria-labelledby="your-batches-heading" className="flex flex-col gap-4">
          <h2 id="your-batches-heading" className="sr-only">
            Your batches
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {myBatches.map(({ batch, role }) => (
              <li key={batch.id}>
                <Card className="group h-full transition-[box-shadow,border-color] duration-200 hover:border-border-strong hover:shadow-floating">
                  <Link
                    href={`/batches/${batch.id}`}
                    className="flex h-full flex-col gap-5 rounded-xl p-5 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        aria-hidden="true"
                        className="font-display flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-heading-sm text-primary"
                      >
                        {batch.name.trim().charAt(0).toUpperCase() || "B"}
                      </span>
                      <RoleBadge role={role} />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="font-display text-heading-sm leading-tight text-foreground">
                        {batch.name}
                      </span>
                      <span className="text-body-sm text-foreground-muted">
                        {batch.institutionName}
                        {batch.graduationYear !== null ? ` · Class of ${batch.graduationYear}` : ""}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-body-sm font-medium text-primary">
                      Open batch
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deletedBatches.length > 0 && <DeletedBatchesList batches={deletedBatches} />}
    </FadeIn>
  );
}
