import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy with automatic 1-time reload on chunk-load failure.
 *
 * After an HMR update or a new deploy, the browser may hold references to old
 * module URLs (`?t=<oldTimestamp>` in dev, hashed filenames in prod). When the
 * user navigates to a route that triggers one of these stale dynamic imports,
 * the fetch fails with "Failed to fetch dynamically imported module" and React
 * shows a blank screen.
 *
 * This helper catches that failure exactly once per browser session (tracked
 * via sessionStorage) and triggers a hard reload, which re-resolves the
 * current module URLs from the server. If the reload still fails, the original
 * error propagates so the user sees a real error boundary instead of an
 * infinite reload loop.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    const STORAGE_KEY = "lazy-retry-reloaded";
    try {
      const mod = await factory();
      // Successful load → clear any previous retry flag for future failures.
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // sessionStorage may be unavailable (private mode, SSR, etc.) — ignore.
      }
      return mod;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(message) ||
        /Loading chunk \d+ failed/i.test(message) ||
        /error loading dynamically imported module/i.test(message);

      let alreadyRetried = false;
      try {
        alreadyRetried = window.sessionStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        // ignore
      }

      if (isChunkError && !alreadyRetried) {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // ignore
        }
        // Trigger a hard reload to fetch fresh module URLs.
        window.location.reload();
        // Return a never-resolving promise so React keeps the Suspense
        // fallback visible until the reload happens.
        return new Promise<{ default: T }>(() => {});
      }

      throw err;
    }
  });
}
