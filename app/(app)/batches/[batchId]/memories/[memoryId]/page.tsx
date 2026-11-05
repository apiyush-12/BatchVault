import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Pencil, Sparkles } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { CommentList } from "@/features/comments/components/comment-list";
import { listComments } from "@/features/comments/queries";
import { canEditMemory } from "@/features/memories/permissions";
import { getMemoryDetail } from "@/features/memories/queries";
import { getMyMembership } from "@/features/memberships/queries";
import { ReportButton } from "@/features/moderation/components/report-button";
import { ReactionPicker } from "@/features/reactions/components/reaction-picker";
import { getReactionSummary } from "@/features/reactions/queries";
import { getVerifiedUser } from "@/lib/auth/session";
import { formatDateOnly } from "@/lib/format/date";
import { isUuid } from "@/lib/validation/ids";

export const metadata = { title: "Memory — BatchVault" };

/**
 * Memory detail (phases.md Phase 5A): media-dominant layout, caption,
 * event/date, comments and reactions (Phase 6). Same indistinguishable
 * denial as every other page (security.md §3).
 *
 * Desktop uses the extra width for media beside the story (design.md §24,
 * §32); phones stack. Edit and report stay secondary (design.md §32).
 */
export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ batchId: string; memoryId: string }>;
}) {
  const { batchId, memoryId } = await params;
  if (!isUuid(batchId) || !isUuid(memoryId)) {
    return <NotAvailableState />;
  }

  // One round trip for everything. Comments and reactions are RLS-scoped to
  // the same visibility as the memory, so starting them before the guard
  // below reveals nothing — a denied caller simply gets empty results.
  const [user, batch, membership, memory, comments, reactionSummary] = await Promise.all([
    getVerifiedUser(),
    getBatchById(batchId),
    getMyMembership(batchId),
    getMemoryDetail(memoryId),
    listComments(memoryId),
    getReactionSummary(memoryId),
  ]);

  if (
    batch === null ||
    membership === null ||
    membership.status !== "active" ||
    memory === null ||
    memory.batchId !== batchId
  ) {
    return <NotAvailableState />;
  }

  const canEdit = user !== null && canEditMemory(memory.createdBy, user.id);
  const isVideo = memory.mediaKind === "video";

  return (
    <FadeIn className="flex flex-1 flex-col gap-6 pb-10">
      <div className="flex items-center justify-between gap-4">
        <BackLink href={`/batches/${batchId}/memories`}>{batch.name}</BackLink>
        {canEdit && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/batches/${batchId}/memories/${memoryId}/edit`} aria-label="Edit memory">
              <Pencil aria-hidden="true" className="size-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-start">
        {/* Media — the hero (design.md §11, §32). The true aspect is preserved via object-contain. */}
        <figure className="flex flex-col gap-4 lg:sticky lg:top-10">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface-sunken shadow-floating ring-1 ring-border/60 sm:aspect-[4/3]">
            {isVideo && memory.mediaUrl !== null ? (
              <video
                src={memory.mediaUrl}
                poster={memory.posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="size-full object-contain"
              />
            ) : memory.mediaUrl !== null ? (
              <Image
                src={memory.mediaUrl}
                alt={memory.caption ?? ""}
                fill
                unoptimized
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-contain"
              />
            ) : null}
          </div>

          <figcaption className="flex flex-col gap-3">
            {memory.caption !== null && (
              <p className="font-display text-heading-md leading-snug text-foreground sm:text-heading-lg">
                {memory.caption}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {memory.eventName !== null && (
                <Badge variant="primary">
                  <Sparkles aria-hidden="true" />
                  {memory.eventName}
                </Badge>
              )}
              <Badge variant="outline">
                <CalendarDays aria-hidden="true" />
                <time dateTime={memory.occurredOn}>{formatDateOnly(memory.occurredOn)}</time>
              </Badge>
            </div>
          </figcaption>
        </figure>

        {/* Story — reactions, comments, quiet report affordance */}
        <aside className="flex flex-col gap-6">
          <section aria-label="Reactions" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-raised">
            <p className="text-caption font-semibold tracking-wide text-foreground-muted uppercase">
              How this felt
            </p>
            <ReactionPicker memoryId={memoryId} summary={reactionSummary} />
          </section>

          <CommentList comments={comments} memoryId={memoryId} />

          <div className="flex justify-end">
            <ReportButton targetKind="memory" targetId={memoryId} />
          </div>
        </aside>
      </div>
    </FadeIn>
  );
}
