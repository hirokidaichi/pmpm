import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceDetailLoading() {
  return (
    <main className="px-6 pb-20 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div>
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="mt-4 h-4 w-full max-w-md" />
        </div>

        <section>
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass rounded-3xl p-6 space-y-4">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
