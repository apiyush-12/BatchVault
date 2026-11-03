import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** The quiet "go up one level" link used as a page eyebrow. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-9 w-fit items-center gap-1.5 rounded-md text-body-sm font-medium text-foreground-muted transition-colors hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}
