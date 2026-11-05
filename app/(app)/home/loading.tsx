import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your batches" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    </div>
  );
}
