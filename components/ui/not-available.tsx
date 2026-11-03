import Link from "next/link";
import { EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The one shared "can't show this" state (design.md §20; security.md §3,
 * "indistinguishable denial"; architecture §18.6). Rendered identically
 * whether a batch doesn't exist or the caller simply isn't a member of it —
 * a stranger must never be able to tell those two cases apart by what the
 * UI looks like.
 */
export function NotAvailableState() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-sm flex-col items-center justify-center gap-5 px-5 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-sunken text-foreground-muted">
        <EyeOff aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-2">
        <p className="font-display text-heading-md text-foreground">Can&rsquo;t show this</p>
        <p className="max-w-prose text-body text-foreground-muted">
          This page isn&rsquo;t available. It may not exist, or you may not have
          access to it.
        </p>
      </div>
      <Button asChild variant="secondary">
        <Link href="/home">Back to home</Link>
      </Button>
    </div>
  );
}
