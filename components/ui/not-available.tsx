import Link from "next/link";

/**
 * The one shared "can't show this" state (design.md §20; security.md §3,
 * "indistinguishable denial"; architecture §18.6). Rendered identically
 * whether a batch doesn't exist or the caller simply isn't a member of it —
 * a stranger must never be able to tell those two cases apart by what the
 * UI looks like.
 */
export function NotAvailableState() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-5 py-10 text-center">
      <p className="text-heading-md font-semibold">Can&rsquo;t show this</p>
      <p className="max-w-prose text-body text-foreground-muted">
        This page isn&rsquo;t available. It may not exist, or you may not have
        access to it.
      </p>
      <Link
        href="/home"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to home
      </Link>
    </div>
  );
}
