import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectDetailLoading() {
  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div>
          <Skeleton className="mb-4 h-4 w-20" />
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-none shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-6 w-16 rounded-none" />
                <Skeleton className="h-6 w-20 rounded-none" />
              </div>
              <Skeleton className="h-4 w-full max-w-md" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <div className="glass-chip rounded-none p-1 flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-none" />
              ))}
            </div>
            <div className="glass rounded-none p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>

          <div className="glass rounded-none p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 rounded-none" />
              <Skeleton className="h-20 rounded-none" />
            </div>
            <Skeleton className="h-3 w-20" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1.5 w-full rounded-none" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
