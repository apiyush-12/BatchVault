"use client";

import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shared fallback for route `error.tsx` boundaries (design.md §20). Generic
 * by design: the thrown error's message is never shown — in production a
 * Server Component error carries only a digest, and that is all we surface.
 */
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60dvh] max-w-sm flex-col items-center justify-center gap-5 px-5 py-16 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-heading-md text-foreground">Something went wrong</h1>
        <p className="max-w-prose text-body text-foreground-muted">
          This page couldn&rsquo;t load just now. It&rsquo;s usually a brief connection problem —
          trying again often fixes it.
        </p>
        {digest !== null && (
          <p className="text-caption text-foreground-muted">Reference: {digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => retry()}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
