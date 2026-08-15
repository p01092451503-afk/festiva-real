import { Loader2 } from "lucide-react";

interface PageLoadingProps {
  /** Optional label under the spinner. Defaults to "로딩 중". */
  label?: string;
  /** Extra classes for the wrapper. */
  className?: string;
  /** Vertical padding size. */
  size?: "sm" | "md" | "lg";
}

/**
 * Unified loading animation used across the app.
 * Replaces the previous skeleton placeholders: a single calm spinner
 * with a short "loading" label, so every page loads the same way.
 */
const PageLoading = ({ label = "로딩 중", className = "", size = "md" }: PageLoadingProps) => {
  const pad = size === "sm" ? "py-8" : size === "lg" ? "py-24" : "py-16";
  const icon = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`w-full flex flex-col items-center justify-center gap-3 ${pad} animate-fade-in ${className}`}
    >
      <Loader2 className={`${icon} animate-spin text-muted-foreground`} aria-hidden="true" />
      <p className="text-xs sm:text-sm text-muted-foreground tracking-wide">{label}</p>
    </div>
  );
};

/** Full-viewport loading animation for route guards / lazy routes. */
export const FullPageLoading = ({ label }: { label?: string }) => (
  <div className="min-h-screen w-full flex items-center justify-center bg-background">
    <PageLoading label={label} size="lg" />
  </div>
);

export default PageLoading;
