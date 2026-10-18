import { Archive } from "lucide-react";

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
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-8 px-5 py-10">
      <span className="inline-flex items-center gap-2 text-heading-sm font-semibold">
        <Archive aria-hidden="true" className="size-5 text-primary" />
        BatchVault
      </span>
      <main id="main" className="flex w-full flex-col items-center">
        <InviteLandingView />
      </main>
    </div>
  );
}
