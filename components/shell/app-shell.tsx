import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { SidebarNav, type ShellBatchLink } from "@/components/shell/sidebar-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/authentication/actions";

/**
 * The authenticated application shell (design.md §15, §22–24).
 *
 * Desktop: a persistent, quiet sidebar — identity, Home, the user's batches,
 * account. Mobile: a compact top bar; the sidebar is `hidden`, never squeezed
 * onto a phone. The same information architecture on every width.
 *
 * Sign-out is a plain `<form>` action so it works without client JS, exactly
 * as `SignOutButton` always has.
 */
export function AppShell({
  children,
  displayName,
  avatarUrl,
  batches,
}: {
  children: ReactNode;
  displayName: string | null;
  avatarUrl: string | null;
  batches: ShellBatchLink[];
}) {
  return (
    <div className="bg-paper min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border/80 bg-surface/70 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:px-4 lg:py-6">
        <div className="px-2">
          <Wordmark />
        </div>

        <SidebarNav batches={batches} />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-sunken"
          >
            <Avatar src={avatarUrl} name={displayName} size="sm" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body-sm font-medium text-foreground">
                {displayName ?? "Your account"}
              </span>
              <span className="text-caption text-foreground-muted">Account settings</span>
            </span>
          </Link>
          <div className="flex items-center justify-between gap-2 px-1">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden="true" className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Mobile / tablet top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md lg:hidden">
          <Wordmark size="sm" />
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              aria-label="Account settings"
              className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-surface-sunken"
            >
              {avatarUrl !== null || displayName !== null ? (
                <Avatar src={avatarUrl} name={displayName} size="sm" />
              ) : (
                <Settings aria-hidden="true" className="size-5 text-foreground-muted" />
              )}
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOut aria-hidden="true" className="size-5" />
              </Button>
            </form>
          </div>
        </header>

        <main
          id="main"
          className="pb-safe mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
