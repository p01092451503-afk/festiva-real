interface PageLoadingProps {
  /** Accessible loading label. */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
  /** Vertical padding size. */
  size?: "sm" | "md" | "lg";
}

/**
 * Unified loading indicator used across the app — same ring spinner as the
 * boot spinner in index.html so only one spinner style ever appears.
 */
const PageLoading = ({ label = "로딩 중", className = "", size = "md" }: PageLoadingProps) => {
  const pad = size === "sm" ? "py-6" : size === "lg" ? "py-20" : "py-12";
  const iconSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-10 w-10" : "h-8 w-8";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={`w-full flex items-center justify-center ${pad} ${className}`}
    >
      <div className={`app-spinner ${iconSize}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
};


/** Full-viewport spinner for route guards / lazy routes. */
export const FullPageLoading = ({ label }: { label?: string }) => (
  <div className="min-h-screen w-full bg-background flex items-center justify-center">
    <PageLoading label={label} size="lg" />
  </div>
);

export default PageLoading;
