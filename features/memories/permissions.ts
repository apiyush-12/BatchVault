/**
 * Layer 2 only (defense in depth / good errors, architecture §5) — mirrors
 * `memories_update_own`'s own `created_by = auth.uid()` check exactly
 * (phases.md Phase 4B; PRD #7, resolved 2026-10-24). The database policy,
 * not this function, is the actual authorization boundary; this exists so
 * the UI can hide/show the Edit control honestly and the Server Action can
 * fail fast with a generic error before ever reaching the database.
 *
 * There is no `canDeleteMemory` — PRD #7 resolved author self-delete as
 * NOT permitted in MVP. Removal of any memory, including the author's own,
 * is mod+ only, via the Phase 8A moderator-removal path (not yet built).
 */
export function canEditMemory(memoryCreatedBy: string | null, callerId: string): boolean {
  return memoryCreatedBy !== null && memoryCreatedBy === callerId;
}
