import { Skeleton } from "@/components/ui/skeleton";

interface PageLoadingProps {
  /** Kept for API compatibility — used as the accessible loading label. */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
  /** Vertical padding size. */
  size?: "sm" | "md" | "lg";
}

/**
 * Unified loading placeholder used across the app.
 * Renders a content-shaped skeleton (no spinner) so the layout does not jump
 * once real data arrives.
 */
const PageLoading = ({ label = "로딩 중", className = "", size = "md" }: PageLoadingProps) => {
  const pad = size === "sm" ? "py-4" : size === "lg" ? "py-12" : "py-8";
  const rows = size === "sm" ? 2 : size === "lg" ? 4 : 3;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={`w-full ${pad} animate-fade-in ${className}`}
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-4">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-8 w-2/3 max-w-md rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
};

/** Full-viewport skeleton for route guards / lazy routes. */
export const FullPageLoading = ({ label }: { label?: string }) => (
  <div className="min-h-screen w-full bg-background">
    <div className="h-16 w-full bg-navy/90" />
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <PageLoading label={label} size="lg" />
    </div>
  </div>
);

export default PageLoading;
