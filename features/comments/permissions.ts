/** Layer 2 only — mirrors `comments_update_own`'s `author_id = auth.uid()` check (security.md §5.4). */
export function canEditComment(authorId: string | null, callerId: string): boolean {
  return authorId !== null && authorId === callerId;
}
