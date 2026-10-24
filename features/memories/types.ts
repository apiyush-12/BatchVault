import type { MediaKind } from "@/features/media/types";

export interface Memory {
  id: string;
  batchId: string;
  createdBy: string | null;
  caption: string | null;
  eventName: string | null;
  occurredOn: string;
  createdAt: string;
}

export interface MemoryWithMedia extends Memory {
  mediaKind: MediaKind | null;
  /** A signed URL to the primary asset — an image derivative, or the video itself. */
  mediaUrl: string | null;
  /** A signed URL to the video's poster-frame companion image, if one was captured and linked (phases.md Phase 4B). Always `null` for image memories. */
  posterUrl: string | null;
  /** Whether the current caller is this memory's author — drives the Edit affordance only; the database enforces the real check (PRD #7). */
  isOwnMemory: boolean;
}
