import { Skeleton } from "@/components/ui/skeleton";
import ChartLoadingState from "@/components/charts/ChartLoadingState";

/**
 * Reusable skeleton building blocks for the main pages.
 * All blocks rely on the shimmer-enabled <Skeleton /> primitive.
 */

/** Full-viewport skeleton used for app-level redirects/route guards. Mimics the dashboard chrome. */
export const FullScreenSkeleton = () => (
  <div className="flex min-h-screen bg-background animate-fade-in">
    {/* Sidebar */}
    <aside className="hidden lg:flex flex-col w-64 border-r border-sidebar-border bg-sidebar p-6 gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full mt-1" />
      <div className="mt-6 space-y-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
      </div>
    </aside>
    {/* Main */}
    <div className="flex-1 flex flex-col">
      <header className="h-16 border-b border-border flex items-center px-6 gap-3">
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="pl-3 border-l border-border flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-3 w-20 hidden sm:block" />
        </div>
      </header>
      <main className="flex-1 p-6 lg:p-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <StatCardGridSkeleton count={4} />
        <CourseCardGridSkeleton count={3} cols={3} />
      </main>
    </div>
  </div>
);

/** Compact in-page loader: centered shimmer card, used for page-section spinners. */
export const InlineBlockSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`w-full max-w-md mx-auto space-y-3 py-12 animate-fade-in ${className}`}>
    <Skeleton className="h-4 w-1/2 mx-auto" />
    <Skeleton className="h-3 w-1/3 mx-auto" />
    <Skeleton className="h-24 w-full rounded-xl" />
  </div>
);

/** Video player skeleton — 16:9, with subtle play-icon placeholder. */
export const VideoPlayerSkeleton = () => (
  <div className="aspect-video w-full relative overflow-hidden">
    <Skeleton className="absolute inset-0 rounded-none" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-16 w-16 rounded-full bg-foreground/5 backdrop-blur-sm border border-border/40" />
    </div>
  </div>
);

export const StatCardSkeleton = () => (
  <div className="stat-card !p-3 space-y-2">
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3.5 w-3.5 rounded" />
    </div>
    <Skeleton className="h-6 w-12" />
    <Skeleton className="h-2.5 w-20" />
  </div>
);

export const StatCardGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
);

export const CourseCardSkeleton = () => (
  <div className="rounded-2xl border border-border bg-card overflow-hidden">
    <Skeleton className="aspect-[16/10] w-full rounded-none" />
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  </div>
);

export const CourseCardGridSkeleton = ({
  count = 4,
  cols = 4,
}: {
  count?: number;
  cols?: 2 | 3 | 4;
}) => {
  const colClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid gap-5 ${colClass}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const ListItemSkeleton = () => (
  <div className="!p-4 sm:!p-5 space-y-3 border-b-2 border-border/80 last:border-b-0">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-9 w-24 rounded-full" />
    </div>
    <Skeleton className="h-2 w-full" />
  </div>
);

export const ListBlockSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="rounded-2xl overflow-hidden border border-border">
    {Array.from({ length: count }).map((_, i) => (
      <ListItemSkeleton key={i} />
    ))}
  </div>
);

export const SectionHeaderSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-7 w-48" />
    <Skeleton className="h-4 w-64" />
  </div>
);

/** Full student dashboard skeleton */
export const StudentDashboardSkeleton = () => (
  <div className="space-y-8">
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-32" />
    </div>
    <StatCardGridSkeleton count={8} />
    <div className="stat-card !p-6 space-y-5">
      <SectionHeaderSkeleton />
      <ListBlockSkeleton count={3} />
    </div>
    <div className="stat-card !p-6 space-y-5">
      <SectionHeaderSkeleton />
      <CourseCardGridSkeleton count={3} cols={3} />
    </div>
  </div>
);

/** Storefront home skeleton (hero + categories + course rows) */
export const StorefrontHomeSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="border-b border-border h-14" />
    <Skeleton className="w-full h-[320px] sm:h-[380px] rounded-none" />
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-10 flex justify-center gap-8 sm:gap-12">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </section>
    <section className="max-w-6xl mx-auto px-4 pt-14 pb-10 space-y-8">
      <SectionHeaderSkeleton />
      <CourseCardGridSkeleton count={4} cols={4} />
    </section>
    <section className="max-w-6xl mx-auto px-4 py-14 space-y-8">
      <SectionHeaderSkeleton />
      <CourseCardGridSkeleton count={4} cols={4} />
    </section>
  </div>
);

/** Course detail skeleton (header + curriculum) */
export const CourseDetailSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-20 rounded-full" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <ListBlockSkeleton count={5} />
      </div>
    </div>
  </div>
);

/** Admin/teacher dashboard skeleton */
export const AdminDashboardSkeleton = () => (
  <div className="space-y-5">
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-40" />
    </div>
    <Skeleton className="h-20 w-full rounded-xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  </div>
);

/**
 * Lightweight chart placeholder used as Suspense fallback while
 * the recharts vendor chunk (~113KB gzip) is fetched on demand.
 * Keeps the chart's container height stable so layout doesn't jump.
 */
export const ChartFallback = ({ className = "" }: { className?: string }) => (
  <div className={`w-full h-full ${className}`}>
    <ChartLoadingState height="h-full" />
  </div>
);
