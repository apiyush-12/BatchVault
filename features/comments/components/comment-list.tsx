import type { Comment } from "../types";
import { CommentForm } from "./comment-form";

/**
 * Flat, chronological comment thread (database.md §3.7; design.md §16-17,
 * kept intentionally simple for this pass — no drawer, no optimistic UI).
 */
export function CommentList({
  comments,
  memoryId,
}: {
  comments: Comment[];
  memoryId: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading-sm font-semibold">Comments</h2>
      <CommentForm memoryId={memoryId} />
      {comments.length === 0 ? (
        <p className="text-body-sm text-foreground-muted">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-body-sm font-medium text-foreground">
                  {comment.authorDisplayName}
                </span>
                <span className="text-caption text-foreground-muted">
                  {new Date(comment.createdAt).toLocaleDateString()}
                  {comment.editedAt !== null ? " · edited" : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-body-sm text-foreground">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
