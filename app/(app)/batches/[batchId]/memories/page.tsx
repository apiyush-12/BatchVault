import Link from "next/link";
import { ChevronDown, Images, Upload } from "lucide-react";

import { BatchFrame } from "@/components/batch/batch-frame";
import { MemoryCard } from "@/components/memory/memory-card";
import { MemoryGrid } from "@/components/memory/memory-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { listGalleryPage } from "@/features/memories/queries";
import { getMyMembership } from "@/features/memberships/queries";

export const metadata = { title: "Memories — BatchVault" };

/**
 * The real, keyset-paginated gallery (phases.md Phase 5A) — supersedes
 * Phase 4A's "minimal verification list". Server-rendered, ordered
 * `occurred_on DESC, id DESC` (database.md §3.5's gallery index), never the
 * whole archive in one query (architecture §19; rules.md §2).
 */
export default async function BatchMemoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { batchId } = await params;
  const { cursor: cursorParam } = await searchParams;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const cursor = (() => {
    if (cursorParam === undefined) return null;
    const [occurredOn, id] = cursorParam.split("_");
    return occurredOn !== undefined && id !== undefined ? { occurredOn, id } : null;
  })();

  const { memories, nextCursor } = await listGalleryPage(batchId, cursor);

  return (
    <BatchFrame batch={batch} role={membership.role} current="memories">
      <PageHeader
        size="md"
        title="Memories"
        description={
          cursor === null
            ? "Newest first. Every photo and video your batch has kept here."
            : "Continuing further back."
        }
      />

      {memories.length === 0 && cursor === null ? (
        <EmptyState
          icon={Images}
          title="No memories yet"
          description="Be the first to add one. Photos are kept as originals; location data is stripped before anyone else sees them."
          action={
            <Button asChild>
              <Link href={`/batches/${batchId}/upload`}>
                <Upload aria-hidden="true" className="size-4" />
                Upload your first photo
              </Link>
            </Button>
          }
        />
      ) : memories.length === 0 ? (
        <p className="text-body text-foreground-muted">That&rsquo;s everything — you&rsquo;ve reached the start.</p>
      ) : (
        <MemoryGrid>
          {memories.map((memory) => (
            <li key={memory.id}>
              <MemoryCard memory={memory} batchId={batchId} />
            </li>
          ))}
        </MemoryGrid>
      )}

      {nextCursor !== null && (
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link href={`/batches/${batchId}/memories?cursor=${nextCursor.occurredOn}_${nextCursor.id}`}>
              Load more
              <ChevronDown aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </BatchFrame>
  );
}
