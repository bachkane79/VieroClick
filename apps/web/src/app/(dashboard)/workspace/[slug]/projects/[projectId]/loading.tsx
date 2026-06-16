export default function ProjectSubPageLoading() {
  return (
    <div className="px-6 py-6 space-y-6 animate-pulse">
      {/* Skeleton Title/Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
          <div className="h-3.5 w-64 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
        </div>
        <div className="h-9 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-shimmer" />
      </div>

      {/* Skeleton Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[400px] bg-neutral-200 dark:bg-neutral-800 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50" />
        </div>
        <div className="space-y-4">
          <div className="h-[180px] bg-neutral-200 dark:bg-neutral-800 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50" />
          <div className="h-[180px] bg-neutral-200 dark:bg-neutral-800 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50" />
        </div>
      </div>
    </div>
  );
}
