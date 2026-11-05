import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared skeleton for batch sections without their own `loading.tsx`: the
 * batch header and tab strip in their real positions, then a neutral
 * content block, so nothing jumps when the section arrives.
 */
export default function BatchSectionLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-48 max-w-full" />
        </div>
        <div className="flex gap-1 overflow-hidden">
          <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
