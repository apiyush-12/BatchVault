import { Archive } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * Foundation placeholder (phases.md Phase 0).
 *
 * Phase 0 ships no product surface. This page exists so the app boots, the
 * theme, token, motion and accessibility foundations are exercised by a real
 * render, and the Playwright smoke test has something to assert against. It
 * is deliberately not a dashboard and not a landing page.
 */
export default function FoundationPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-10 px-5 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-heading-sm font-semibold">
          <Archive aria-hidden="true" className="size-5 text-primary" />
          BatchVault
        </span>
        <ThemeToggle />
      </header>

      <main id="main" className="flex flex-1 flex-col justify-center">
        <FadeIn className="flex flex-col gap-4">
          <h1 className="text-heading-lg font-semibold text-balance">
            Foundation
          </h1>
          <p className="max-w-prose text-body text-foreground-muted">
            The BatchVault application shell is in place. Phase 0 sets up the
            toolchain, environment boundaries, database migration framework,
            private storage and quality gates — no product features yet.
          </p>
          <p className="max-w-prose text-body-sm text-foreground-muted">
            Authentication and profiles arrive in Phase 1.
          </p>
        </FadeIn>
      </main>

      <footer className="text-caption text-foreground-muted">
        Private by default. Invite-only. Not a social network.
      </footer>
    </div>
  );
}
