import Image from "next/image";
import Link from "next/link";
import { ImageOff, Play } from "lucide-react";

import type { MemoryWithMedia } from "@/features/memories/types";
import { cn } from "@/lib/cn";
import { formatDateOnly, formatDateOnlyNoYear } from "@/lib/format/date";

/**
 * The media tile (design.md §12, §30): the photo or poster dominates; caption,
 * event and date sit in a quiet scrim that strengthens on hover/focus. The
 * signed URL comes straight from the query — media URL logic is untouched.
 *
 * A video without a poster shows an on-brand neutral placeholder rather than
 * a broken-image glyph (design.md §11).
 */
export function MemoryCard({
  memory,
  batchId,
  showYear = true,
  className,
}: {
  memory: MemoryWithMedia;
  batchId: string;
  showYear?: boolean;
  className?: string;
}) {
  const isVideo = memory.mediaKind === "video";
  const thumbnailUrl = isVideo ? memory.posterUrl : memory.mediaUrl;
  const meta = [
    memory.eventName,
    showYear ? formatDateOnly(memory.occurredOn) : formatDateOnlyNoYear(memory.occurredOn),
  ]
    .filter((part): part is string => part !== null && part !== "")
    .join(" · ");

  return (
    <Link
      href={`/batches/${batchId}/memories/${memory.id}`}
      className={cn(
        "group relative block aspect-square overflow-hidden rounded-xl bg-surface-sunken shadow-raised ring-1 ring-border/60",
        "transition-[box-shadow,transform] duration-200 hover:shadow-floating focus-visible:shadow-floating",
        className,
      )}
    >
      {thumbnailUrl !== null ? (
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-foreground-muted">
          {isVideo ? (
            <span className="flex size-12 items-center justify-center rounded-full bg-surface text-foreground shadow-raised">
              <Play aria-hidden="true" className="ml-0.5 size-5" />
            </span>
          ) : (
            <ImageOff aria-hidden="true" className="size-7" />
          )}
        </span>
      )}

      {isVideo && thumbnailUrl !== null && (
        <span className="absolute top-2.5 left-2.5 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Play aria-hidden="true" className="ml-0.5 size-4" fill="currentColor" />
        </span>
      )}

      {/* Scrim with caption/meta — readable over any photo (design.md §4 overlay). This text is the link's accessible name. */}
      <span
        className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pt-10 pb-2.5 text-white transition-opacity duration-200"
      >
        {memory.caption !== null && (
          <span className="line-clamp-2 text-body-sm font-medium leading-snug drop-shadow-sm">
            {memory.caption}
          </span>
        )}
        <span className="truncate text-caption text-white/80">
          {memory.caption === null && <span className="sr-only">{isVideo ? "Video" : "Photo"}, </span>}
          {meta}
        </span>
      </span>
    </Link>
  );
}

/** Skeleton shaped exactly like a `MemoryCard` (design.md §18). */
export function MemoryCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer aspect-square rounded-xl bg-surface-sunken", className)}
    />
  );
}
