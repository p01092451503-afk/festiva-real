/**
 * Warms up the JS chunks of the routes users navigate to most often.
 *
 * Route components are code-split, so the first click on a menu item pays the
 * network cost of fetching that chunk. Prefetching them while the browser is
 * idle makes those navigations feel instant, without delaying the first paint
 * of the current page.
 */
const loaders: Array<() => Promise<unknown>> = [
  () => import("@/pages/store/StorefrontCatalog"),
  () => import("@/pages/store/StorefrontCourseDetail"),
  () => import("@/pages/public/About"),
  () => import("@/pages/public/Support"),
  () => import("@/pages/Auth"),
  () => import("@/pages/StudentDashboard"),
  () => import("@/pages/student/StudentCourses"),
];

export function prefetchCommonRoutes() {
  if (typeof window === "undefined") return;

  const run = () => {
    // Skip on metered / very slow connections.
    const conn = (navigator as any).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /2g/.test(conn.effectiveType)) return;

    let i = 0;
    const next = () => {
      const loader = loaders[i++];
      if (!loader) return;
      loader()
        .catch(() => {})
        .finally(() => {
          const idle = (window as any).requestIdleCallback;
          idle ? idle(next, { timeout: 2000 }) : window.setTimeout(next, 300);
        });
    };
    next();
  };

  const start = () => {
    const idle = (window as any).requestIdleCallback;
    idle ? idle(run, { timeout: 3000 }) : window.setTimeout(run, 1500);
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
