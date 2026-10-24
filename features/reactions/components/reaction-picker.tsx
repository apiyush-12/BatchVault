"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeReactionAction, setReactionAction } from "../actions";
import { REACTION_EMOJI, REACTION_KINDS, type ReactionKind, type ReactionSummary } from "../types";

/** "Who felt what" (database.md §3.8) — a switchable reaction, not an accumulating like count. */
export function ReactionPicker({ memoryId, summary }: { memoryId: string; summary: ReactionSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick(kind: ReactionKind) {
    setPending(true);
    if (summary.myReaction === kind) {
      await removeReactionAction(memoryId);
    } else {
      await setReactionAction({ memoryId, kind });
    }
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="React to this memory">
      {REACTION_KINDS.map((kind) => {
        const count = summary.counts[kind] ?? 0;
        const isMine = summary.myReaction === kind;
        return (
          <button
            key={kind}
            type="button"
            disabled={pending}
            onClick={() => handleClick(kind)}
            aria-pressed={isMine}
            aria-label={`React with ${REACTION_EMOJI[kind]} (${kind})`}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-body-sm transition-colors ${
              isMine
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-foreground-muted hover:text-foreground"
            }`}
          >
            <span aria-hidden="true">{REACTION_EMOJI[kind]}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
