import Link from "next/link";
import { Clock, Plus } from "lucide-react";

import { BatchFrame } from "@/components/batch/batch-frame";
import { MemoryCard } from "@/components/memory/memory-card";
import { MemoryGrid } from "@/components/memory/memory-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { listTimeline } from "@/features/memories/queries";
import { getMyMembership } from "@/features/memberships/queries";

export const metadata = { title: "Timeline — BatchVault" };

/**
 * Timeline & event grouping (phases.md Phase 5B) — a date-anchored
 * browsing mode distinct from the gallery, grouped by calendar year. No
 * stated-vs-defaulted `occurred_on` distinction is made (Q5: "may resolve
 * as no change" — taken here).
 *
 * Visually: a vertical rail with one marker per year, a quick year jump at
 * the top for long archives (design.md §31), and the same memory cards as
 * the gallery so the two views feel like one product.
 */
export default async function BatchTimelinePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  // The timeline read is RLS-scoped to active members, so it runs alongside
  // the guard queries rather than after them.
  const [batch, membership, groups] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
    listTimeline(batchId),
  ]);

  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const total = groups.reduce((sum, group) => sum + group.memories.length, 0);

  return (
    <BatchFrame batch={batch} role={membership.role} current="timeline">
      <PageHeader
        size="md"
        title="Timeline"
        description={
          groups.length === 0
            ? "Your batch's story, year by year, once there are memories to tell it."
            : `${total} ${total === 1 ? "memory" : "memories"} across ${groups.length} ${groups.length === 1 ? "year" : "years"}.`
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No memories yet"
          description="The timeline fills in as memories are added with the date they happened."
          action={
            <Button asChild>
              <Link href={`/batches/${batchId}/upload`}>
                <Plus aria-hidden="true" className="size-4" />
                Add a memory
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {groups.length > 1 && (
            <nav aria-label="Jump to a year" className="-mx-4 sm:mx-0">
              <ul className="scrollbar-none flex gap-2 overflow-x-auto px-4 sm:px-0 sm:flex-wrap">
                {groups.map((group) => (
                  <li key={group.year} className="shrink-0">
                    <a
                      href={`#year-${group.year}`}
                      className="inline-flex min-h-9 items-center rounded-full border border-border bg-surface px-3.5 text-body-sm font-medium text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground"
                    >
                      {group.year}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <ol className="relative flex flex-col gap-12 border-l-2 border-border/80 pl-6 sm:pl-10">
            {groups.map((group) => (
              <li
                key={group.year}
                id={`year-${group.year}`}
                className="relative scroll-mt-24 flex flex-col gap-5"
              >
                {/* Year marker on the rail */}
                <span
                  aria-hidden="true"
                  className="absolute top-2 -left-[2.0625rem] flex size-4 items-center justify-center rounded-full border-2 border-primary bg-background sm:-left-[3.0625rem]"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                </span>

                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-display-sm leading-none text-foreground sm:text-display">
                    {group.year}
                  </h2>
                  <p className="text-body-sm text-foreground-muted">
                    {group.memories.length} {group.memories.length === 1 ? "memory" : "memories"}
                  </p>
                </div>

                <MemoryGrid dense>
                  {group.memories.map((memory) => (
                    <li key={memory.id}>
                      <MemoryCard memory={memory} batchId={batchId} showYear={false} compact />
                    </li>
                  ))}
                </MemoryGrid>
              </li>
            ))}
          </ol>
        </>
      )}
    </BatchFrame>
  );
}
