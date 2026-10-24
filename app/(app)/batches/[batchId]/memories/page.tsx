import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Play, Plus } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
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
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href={`/batches/${batchId}`}
            className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {batch.name}
          </Link>
          <h1 className="text-heading-lg font-semibold">Memories</h1>
        </div>
        <Link
          href={`/batches/${batchId}/upload`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-body-sm font-medium text-primary-foreground shadow-raised hover:bg-primary-hover"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add
        </Link>
      </header>

      {memories.length === 0 && cursor === null ? (
        <p className="text-body text-foreground-muted">
          No memories yet. Be the first to add one.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {memories.map((memory) => (
            <li key={memory.id}>
              <Link
                href={`/batches/${batchId}/memories/${memory.id}`}
                className="flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface transition-opacity hover:opacity-90"
              >
                <div className="relative aspect-square bg-surface-sunken">
                  {memory.mediaKind === "video" ? (
                    <>
                      {memory.posterUrl !== null && (
                        <Image src={memory.posterUrl} alt="" fill unoptimized className="object-cover" />
                      )}
                      <Play aria-hidden="true" className="absolute inset-0 m-auto size-8 text-white drop-shadow" />
                    </>
                  ) : memory.mediaUrl !== null ? (
                    <Image src={memory.mediaUrl} alt={memory.caption ?? ""} fill unoptimized className="object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  {memory.caption !== null && (
                    <p className="line-clamp-2 text-caption text-foreground">{memory.caption}</p>
                  )}
                  <p className="text-caption text-foreground-muted">
                    {memory.eventName !== null ? `${memory.eventName} · ` : ""}
                    {new Date(memory.occurredOn).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {nextCursor !== null && (
        <Link
          href={`/batches/${batchId}/memories?cursor=${nextCursor.occurredOn}_${nextCursor.id}`}
          className="self-center text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          Load more
        </Link>
      )}
    </div>
  );
}
