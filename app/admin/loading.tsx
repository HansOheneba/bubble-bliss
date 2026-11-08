import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="w-40 h-9" />
      <Skeleton className="w-64 h-14" />
      <div className="flex flex-col gap-3">
        <Skeleton className="w-full h-5" />
        <Skeleton className="w-full h-5" />
        <Skeleton className="w-full h-5" />
      </div>
      <Skeleton className="w-full h-40" />
    </div>
  );
}
