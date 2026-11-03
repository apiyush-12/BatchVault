import type { ReactNode } from "react";

import { MemoryCardSkeleton } from "@/components/memory/memory-card";
import { cn } from "@/lib/cn";

/**
 * The gallery grid: two columns on a phone, three on a tablet, four on
 * desktop — dense by design (design.md §7, §30), with small gaps so the
 * photography reads as one wall of memories.
 */
export function MemoryGrid({
  children,
  dense = false,
  className,
}: {
  children: ReactNode;
  dense?: boolean;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid gap-2 sm:gap-3",
        dense
          ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function MemoryGridSkeleton({ count = 8, dense = false }: { count?: number; dense?: boolean }) {
  return (
    <MemoryGrid dense={dense}>
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <MemoryCardSkeleton />
        </li>
      ))}
    </MemoryGrid>
  );
}
