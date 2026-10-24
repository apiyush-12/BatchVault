export interface Comment {
  id: string;
  batchId: string;
  memoryId: string;
  authorId: string | null;
  authorDisplayName: string | null;
  body: string;
  editedAt: string | null;
  createdAt: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";
