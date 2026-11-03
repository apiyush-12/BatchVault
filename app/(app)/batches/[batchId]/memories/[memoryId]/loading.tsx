import { Skeleton } from "@/components/ui/skeleton";

export default function MemoryDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Loading memory" className="flex flex-col gap-6">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-square w-full rounded-2xl sm:aspect-[4/3]" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
