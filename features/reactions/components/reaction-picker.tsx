"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

import { removeReactionAction, setReactionAction } from "../actions";
import { REACTION_EMOJI, REACTION_KINDS, type ReactionKind, type ReactionSummary } from "../types";

/**
 * "Who felt what" (database.md §3.8) — a switchable reaction, not an
 * accumulating like count. The accent tint marks your own choice; counts
 * stay quiet (design.md §32).
 */
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
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-body-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95 disabled:opacity-60",
              isMine
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border bg-surface text-foreground-muted hover:border-border-strong hover:bg-surface-sunken hover:text-foreground",
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {REACTION_EMOJI[kind]}
            </span>
            {count > 0 && <span className="font-medium tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
