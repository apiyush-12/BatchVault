import { Camera, Lock, Users } from "lucide-react";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/**
 * The unauthenticated / pre-app shell for sign-in, sign-up, password reset,
 * onboarding and the invite landing. A warm brand panel carries the product
 * promise; the form sits in a single calm card. On phones the panel folds
 * into a compact header so the form stays above the fold.
 */
export function AuthShell({
  children,
  title,
  description,
  footer,
}: {
  children: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-paper flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel */}
      <aside className="relative flex flex-col justify-between gap-10 px-6 pt-6 pb-8 lg:min-h-dvh lg:border-r lg:border-border/70 lg:bg-surface/60 lg:px-14 lg:py-12">
        <Wordmark href="/sign-in" size="lg" />

        <div className="hidden flex-col gap-8 lg:flex">
          <div className="flex flex-col gap-4">
            <p className="font-display text-display text-foreground">
              A private home for the years you shared.
            </p>
            <p className="max-w-md text-body text-foreground-muted">
              BatchVault keeps your batch&rsquo;s photos, videos and stories in one
              quiet, invite-only place — so they&rsquo;re still here in ten years.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {[
              { Icon: Lock, text: "Invite-only. Nothing is public, ever." },
              { Icon: Camera, text: "Originals preserved; location data stripped from photos." },
              { Icon: Users, text: "Owned by the batch together, not by one account." },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-body-sm text-foreground-muted">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
      </aside>

      {/* Form column */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10 sm:px-8 lg:py-12">
        <main id="main" className="flex w-full max-w-md flex-col gap-6">
          <header className="flex flex-col gap-1.5">
            <h1 className="font-display text-heading-lg text-foreground sm:text-display-sm">{title}</h1>
            {description !== undefined && (
              <p className="text-body-sm text-foreground-muted sm:text-body">{description}</p>
            )}
          </header>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-floating sm:p-8">
            {children}
          </div>

          {footer !== undefined && (
            <div className="flex flex-col gap-2 text-body-sm text-foreground-muted">{footer}</div>
          )}
        </main>

        <div className="mt-8 lg:hidden">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
