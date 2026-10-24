/** Q2 (database.md, resolved 2026-10-24): a small fixed set. */
export const REACTION_KINDS = ["like", "love", "laugh", "wow", "sad"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_EMOJI: Record<ReactionKind, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
};

export interface ReactionSummary {
  counts: Partial<Record<ReactionKind, number>>;
  myReaction: ReactionKind | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";
