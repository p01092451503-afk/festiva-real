import PageLoading, { FullPageLoading } from "@/components/PageLoading";

/**
 * Loading placeholders for the app.
 *
 * Skeleton placeholders were removed project-wide — every loading state now
 * shows the same simple "로딩 중" animation. These named exports are kept so
 * existing imports keep working.
 */

/** Route transitions render nothing (no skeleton/spinner flash). */
export const FullScreenSkeleton = () => null;


/** Compact in-page loader. */
export const InlineBlockSkeleton = ({ className = "" }: { className?: string }) => (
  <PageLoading size="sm" className={className} />
);

/** Video player loader — keeps a 16:9 area so layout doesn't jump. */
export const VideoPlayerSkeleton = () => (
  <div className="aspect-video w-full flex items-center justify-center bg-muted/30">
    <PageLoading label="영상을 불러오는 중" />
  </div>
);

export const StatCardSkeleton = () => <PageLoading size="sm" />;

export const StatCardGridSkeleton = (_props: { count?: number }) => <PageLoading />;

export const CourseCardSkeleton = () => <PageLoading size="sm" />;

export const CourseCardGridSkeleton = (_props: { count?: number; cols?: 2 | 3 | 4 }) => <PageLoading />;

export const ListItemSkeleton = () => <PageLoading size="sm" />;

export const ListBlockSkeleton = (_props: { count?: number }) => <PageLoading />;

export const SectionHeaderSkeleton = () => <PageLoading size="sm" />;

export const StudentDashboardSkeleton = () => <PageLoading size="lg" />;

export const StorefrontHomeSkeleton = () => <FullPageLoading />;

export const CourseDetailSkeleton = () => <PageLoading size="lg" />;

export const AdminDashboardSkeleton = () => <PageLoading size="lg" />;

/** Chart panel loader (kept for Suspense fallbacks). */
export const ChartFallback = ({ className = "" }: { className?: string }) => (
  <div className={`w-full h-full flex items-center justify-center ${className}`}>
    <PageLoading label="차트를 불러오는 중" />
  </div>
);
