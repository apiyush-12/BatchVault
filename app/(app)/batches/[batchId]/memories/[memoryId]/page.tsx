import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

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
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Memory — BatchVault" };

/**
 * Memory detail (phases.md Phase 5A): media-dominant layout, caption,
 * event/date, comments and reactions (Phase 6). Same indistinguishable
 * denial as every other page (security.md §3).
 */
export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ batchId: string; memoryId: string }>;
}) {
  const { batchId, memoryId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  const [batch, membership, memory] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
    getMemoryDetail(memoryId),
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

  const [comments, reactionSummary] = await Promise.all([
    listComments(memoryId),
    getReactionSummary(memoryId),
  ]);

  const canEdit = userData.user !== null && canEditMemory(memory.createdBy, userData.user.id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Link
          href={`/batches/${batchId}/memories`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Gallery
        </Link>
        {canEdit && (
          <Link
            href={`/batches/${batchId}/memories/${memoryId}/edit`}
            className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </Link>
        )}
      </header>

      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-sunken sm:aspect-video">
        {memory.mediaKind === "video" && memory.mediaUrl !== null ? (
          <video
            src={memory.mediaUrl}
            poster={memory.posterUrl ?? undefined}
            controls
            className="size-full object-contain"
          />
        ) : memory.mediaUrl !== null ? (
          <Image src={memory.mediaUrl} alt={memory.caption ?? ""} fill unoptimized className="object-contain" />
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        {memory.caption !== null && <p className="text-body text-foreground">{memory.caption}</p>}
        <p className="text-body-sm text-foreground-muted">
          {memory.eventName !== null ? `${memory.eventName} · ` : ""}
          {new Date(memory.occurredOn).toLocaleDateString()}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <ReactionPicker memoryId={memoryId} summary={reactionSummary} />
        <ReportButton targetKind="memory" targetId={memoryId} />
      </div>

      <CommentList comments={comments} memoryId={memoryId} />
    </div>
  );
}
