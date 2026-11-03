"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Settings } from "lucide-react";

import { cn } from "@/lib/cn";

export interface ShellBatchLink {
  id: string;
  name: string;
  institutionName: string;
  graduationYear: number | null;
}

const linkBase =
  "flex min-h-10 items-center gap-3 rounded-lg px-3 text-body-sm font-medium transition-colors";
const linkIdle = "text-foreground-muted hover:bg-surface-sunken hover:text-foreground";
const linkActive = "bg-primary-soft text-primary";

/**
 * Persistent desktop navigation (design.md §15, §24): Home, the batches the
 * user belongs to, and account settings. Active state is derived from the
 * pathname on the client; everything else is static markup.
 */
export function SidebarNav({ batches }: { batches: ShellBatchLink[] }) {
  const pathname = usePathname();
  // On /home the page itself is the batch switcher; repeating every batch in
  // the sidebar there would be pure duplication (and two links per batch).
  const showBatches = pathname !== "/home";

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto">
      <ul className="flex flex-col gap-1">
        <li>
          <Link
            href="/home"
            aria-current={pathname === "/home" ? "page" : undefined}
            className={cn(linkBase, pathname === "/home" ? linkActive : linkIdle)}
          >
            <Home aria-hidden="true" className="size-4" />
            Home
          </Link>
        </li>
        <li>
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={cn(linkBase, pathname === "/settings" ? linkActive : linkIdle)}
          >
            <Settings aria-hidden="true" className="size-4" />
            Account settings
          </Link>
        </li>
      </ul>

      {showBatches && (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-3">
          <p className="text-caption font-semibold tracking-wide text-foreground-muted uppercase">
            Your batches
          </p>
          <Link
            href="/batches/new"
            aria-label="New batch"
            title="New batch"
            className="flex size-7 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {batches.length === 0 ? (
          <p className="px-3 text-caption text-foreground-muted">
            No batches yet. Create one or join from an invite link.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {batches.map((batch) => {
              const href = `/batches/${batch.id}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={batch.id}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      linkBase,
                      "min-h-11 py-1.5",
                      active ? linkActive : linkIdle,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md text-caption font-semibold",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-sunken text-foreground-muted",
                      )}
                    >
                      {batch.name.trim().charAt(0).toUpperCase() || "B"}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{batch.name}</span>
                      <span className="truncate text-caption font-normal text-foreground-muted">
                        {batch.institutionName}
                        {batch.graduationYear !== null ? ` · ${batch.graduationYear}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}
    </nav>
  );
}
