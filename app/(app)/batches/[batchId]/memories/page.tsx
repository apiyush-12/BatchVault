import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { listRecentMemories } from "@/features/memories/queries";
import { getMyMembership } from "@/features/memberships/queries";

export const metadata = { title: "Memories — BatchVault" };

/**
 * The "minimal verification list" (architecture §8 step 5; phases.md
 * Phase 4A) — deliberately unpolished; the real gallery is Phase 5A.
 */
export default async function BatchMemoriesPage({
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

  const memories = await listRecentMemories(batchId);

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

      {memories.length === 0 ? (
        <p className="text-body text-foreground-muted">
          No memories yet. Be the first to add one.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {memories.map((memory) => (
            <li
              key={memory.id}
              className="flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface"
            >
              <div className="relative aspect-square bg-surface-sunken">
                {memory.mediaKind === "video" && memory.mediaUrl !== null ? (
                  <video
                    src={memory.mediaUrl}
                    poster={memory.posterUrl ?? undefined}
                    controls
                    className="size-full object-cover"
                  />
                ) : memory.mediaUrl !== null ? (
                  <Image
                    src={memory.mediaUrl}
                    alt={memory.caption ?? ""}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5 p-2">
                {memory.caption !== null && (
                  <p className="line-clamp-2 text-caption text-foreground">{memory.caption}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-caption text-foreground-muted">
                    {memory.eventName !== null ? `${memory.eventName} · ` : ""}
                    {new Date(memory.occurredOn).toLocaleDateString()}
                  </p>
                  {memory.isOwnMemory && (
                    <Link
                      href={`/batches/${batchId}/memories/${memory.id}/edit`}
                      aria-label="Edit memory"
                      className="inline-flex items-center text-foreground-muted hover:text-foreground"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
