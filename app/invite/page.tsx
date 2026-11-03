import { Lock } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { InviteLandingView } from "@/features/invitations/components/invite-landing-view";

export const metadata = { title: "You're invited — BatchVault" };

/**
 * The invite landing page (phases.md Phase 3A; security.md §9; design.md
 * §35). Deliberately outside every auth-gated route group — a recipient has
 * not necessarily signed in yet (PRD Journey C) — and minimal: no member
 * list, no member count, no media, no description (security.md §9).
 */
export default function InvitePage() {
  return (
    <div className="bg-paper flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-10">
      <Wordmark href={null} size="lg" />
      <main
        id="main"
        className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-surface p-8 text-center shadow-floating"
      >
        <InviteLandingView />
      </main>
      <p className="inline-flex items-center gap-1.5 text-caption text-foreground-muted">
        <Lock aria-hidden="true" className="size-3.5" />
        Private, invite-only. Nothing on BatchVault is public.
      </p>
    </div>
  );
}
