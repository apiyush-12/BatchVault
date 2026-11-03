import { MessageCircle } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { formatTimestamp } from "@/lib/format/date";

import type { Comment } from "../types";
import { CommentForm } from "./comment-form";

/**
 * Flat, chronological comment thread (database.md §3.7; design.md §16-17,
 * kept intentionally simple for this pass — no drawer, no optimistic UI).
 * A departed author renders as "Former member" (database.md §12).
 */
export function CommentList({
  comments,
  memoryId,
}: {
  comments: Comment[];
  memoryId: string;
}) {
  return (
    <section
      aria-labelledby="comments-heading"
      className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4 shadow-raised sm:p-5"
    >
      <div className="flex items-center gap-2">
        <MessageCircle aria-hidden="true" className="size-4 text-primary" />
        <h2 id="comments-heading" className="text-heading-sm font-semibold">
          Comments
        </h2>
        {comments.length > 0 && (
          <span className="text-caption text-foreground-muted">({comments.length})</span>
        )}
      </div>

      <CommentForm memoryId={memoryId} />

      {comments.length === 0 ? (
        <p className="text-body-sm text-foreground-muted">
          No comments yet. Say what you remember about this one.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => {
            const author = comment.authorDisplayName ?? "Former member";
            return (
              <li key={comment.id} className="flex gap-3">
                <Avatar src={null} name={comment.authorDisplayName} size="sm" className="mt-0.5" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-body-sm font-semibold text-foreground">{author}</span>
                    <span className="text-caption text-foreground-muted">
                      <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
                      {comment.editedAt !== null ? " · edited" : ""}
                    </span>
                  </div>
                  <p className="text-body-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {comment.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
