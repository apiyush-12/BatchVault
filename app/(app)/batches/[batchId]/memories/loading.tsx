import { MemoryGridSkeleton } from "@/components/memory/memory-grid";
import { Skeleton } from "@/components/ui/skeleton";

export default function MemoriesLoading() {
  return (
    <div aria-busy="true" aria-label="Loading memories" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-40 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <MemoryGridSkeleton count={8} />
    </div>
  );
}
