import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { listTimeline } from "@/features/memories/queries";
import { getMyMembership } from "@/features/memberships/queries";

export const metadata = { title: "Timeline — BatchVault" };

/**
 * Timeline & event grouping (phases.md Phase 5B) — a date-anchored
 * browsing mode distinct from the gallery, grouped by calendar year. No
 * stated-vs-defaulted `occurred_on` distinction is made (Q5: "may resolve
 * as no change" — taken here).
 */
export default async function BatchTimelinePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const groups = await listTimeline(batchId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/batches/${batchId}`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {batch.name}
        </Link>
        <h1 className="text-heading-lg font-semibold">Timeline</h1>
      </header>

      {groups.length === 0 ? (
        <p className="text-body text-foreground-muted">No memories yet.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.year} className="flex flex-col gap-3">
              <h2 className="text-heading-sm font-semibold text-foreground">{group.year}</h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.memories.map((memory) => {
                  const thumbnailUrl = memory.mediaKind === "video" ? memory.posterUrl : memory.mediaUrl;
                  return (
                    <li key={memory.id}>
                      <Link
                        href={`/batches/${batchId}/memories/${memory.id}`}
                        className="block overflow-hidden rounded-lg border border-border bg-surface"
                      >
                        <div className="relative aspect-square bg-surface-sunken">
                          {thumbnailUrl !== null && (
                            <Image src={thumbnailUrl} alt="" fill unoptimized className="object-cover" />
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
