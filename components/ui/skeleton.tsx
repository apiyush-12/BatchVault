import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Content-shaped placeholder (design.md §18): same aspect ratio and radius as
 * the content it stands in for, so nothing shifts when the real thing lands.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer rounded-md bg-surface-sunken", className)}
      {...props}
    />
  );
}
