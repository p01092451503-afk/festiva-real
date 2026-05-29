/**
 * Runtime performance reporter — per-route.
 *
 * Outputs a separate console group for EACH route entered.
 *
 * For the very first page load:
 *   FCP, LCP, CLS, INP, TTFB + initial transfer summary.
 *
 * For subsequent SPA route changes (where real FCP/LCP/TTFB no longer fire):
 *   - elementtiming-style "soft LCP" approximation = largest image/text painted
 *     after route entry (PerformanceObserver on largest-contentful-paint emits
 *     once per real load, so for SPA we synthesize from element/largest-paint
 *     observers when available, otherwise skip)
 *   - cumulative layout shift accrued AFTER route entry
 *   - INP for interactions on the new route
 *   - resource transfer added since route entry (new chunks, images, API)
 *   - time from route enter -> first paint after route enter
 *
 * Disabled in dev unless ?perf=1 is in the URL.
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

const RATING_COLOR: Record<string, string> = {
  good: "color:#16a34a;font-weight:600",
  "needs-improvement": "color:#d97706;font-weight:600",
  poor: "color:#dc2626;font-weight:600",
};

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${n.toFixed(0)}ms`);
const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`;

/**
 * Bucket pathnames into stable route groups so analytics-style aggregation
 * is possible (e.g. /admin/courses/123 -> /admin/courses/:id).
 */
const routeGroup = (pathname: string): string => {
  const p = pathname || "/";
  // Common LMS route patterns
  const patterns: Array<[RegExp, string]> = [
    [/^\/admin\/courses\/[^/]+/, "/admin/courses/:id"],
    [/^\/admin\/users\/[^/]+/, "/admin/users/:id"],
    [/^\/admin\/orders\/[^/]+/, "/admin/orders/:id"],
    [/^\/admin\/branches\/[^/]+/, "/admin/branches/:id"],
    [/^\/admin\/tracks\/[^/]+/, "/admin/tracks/:id"],
    [/^\/admin\/videos\/[^/]+/, "/admin/videos/:id"],
    [/^\/admin\/learning\/[^/]+/, "/admin/learning/:id"],
    [/^\/admin\/board\/[^/]+/, "/admin/board/:id"],
    [/^\/admin\/announcements\/[^/]+/, "/admin/announcements/:id"],
    [/^\/admin\/surveys\/[^/]+/, "/admin/surveys/:id"],
    [/^\/teacher\/courses\/[^/]+/, "/teacher/courses/:id"],
    [/^\/teacher\/students\/[^/]+/, "/teacher/students/:id"],
    [/^\/teacher\/assignments\/[^/]+/, "/teacher/assignments/:id"],
    [/^\/student\/courses\/[^/]+\/content\/[^/]+/, "/student/courses/:id/content/:contentId"],
    [/^\/student\/courses\/[^/]+/, "/student/courses/:id"],
    [/^\/student\/tracks\/[^/]+/, "/student/tracks/:id"],
    [/^\/student\/board\/[^/]+/, "/student/board/:id"],
    [/^\/courses\/[^/]+/, "/courses/:id"],
    [/^\/store\/[^/]+/, "/store/:id"],
    [/^\/checkout\/[^/]+/, "/checkout/:id"],
  ];
  for (const [re, label] of patterns) if (re.test(p)) return label;
  return p;
};

const sectionFor = (group: string): string => {
  if (group.startsWith("/admin")) return "Admin";
  if (group.startsWith("/teacher")) return "Teacher";
  if (group.startsWith("/student") || group === "/dashboard" || group.startsWith("/dashboard/")) return "Student";
  if (group.startsWith("/store") || group.startsWith("/checkout") || group.startsWith("/cart")) return "Storefront";
  if (group.startsWith("/auth") || group === "/reset-password") return "Auth";
  return "Public";
};

const HEADER_COLOR: Record<string, string> = {
  Admin: "color:#7c3aed;font-weight:700",
  Teacher: "color:#0891b2;font-weight:700",
  Student: "color:#16a34a;font-weight:700",
  Storefront: "color:#db2777;font-weight:700",
  Auth: "color:#475569;font-weight:700",
  Public: "color:#475569;font-weight:700",
};

interface RouteSnapshot {
  group: string;
  section: string;
  pathname: string;
  enteredAt: number;
  resourceCountAtEnter: number;
  cls: number;
  inp: number | null;
  // soft LCP: largest contentful paint observed AFTER route enter
  softLcp: number | null;
}

let currentRoute: RouteSnapshot | null = null;
let isFirstLoad = true;
let initialized = false;

const newSnapshot = (pathname: string): RouteSnapshot => {
  const resources = (typeof performance !== "undefined" && performance.getEntriesByType)
    ? (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
    : [];
  return {
    group: routeGroup(pathname),
    section: sectionFor(routeGroup(pathname)),
    pathname,
    enteredAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
    resourceCountAtEnter: resources.length,
    cls: 0,
    inp: null,
    softLcp: null,
  };
};

const headerStyle = (section: string) => HEADER_COLOR[section] || "color:#0f172a;font-weight:700";

const logVital = (group: string, m: Metric) => {
  const value = m.name === "CLS" ? m.value.toFixed(3) : fmt(m.value);
  // eslint-disable-next-line no-console
  console.log(
    `%c[${group}] ${m.name}%c  ${value}  %c(${m.rating})`,
    "color:#2563eb;font-weight:700",
    "color:inherit;font-weight:600",
    RATING_COLOR[m.rating] || "color:inherit",
  );
};

const reportInitialTransfer = (group: string, section: string) => {
  if (typeof performance === "undefined" || !performance.getEntriesByType) return;
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  if (!resources.length) return;

  const groups: Record<string, { count: number; bytes: number }> = {
    script: { count: 0, bytes: 0 },
    css: { count: 0, bytes: 0 },
    img: { count: 0, bytes: 0 },
    font: { count: 0, bytes: 0 },
    fetch: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };

  let totalBytes = 0;
  for (const r of resources) {
    const size = r.transferSize || r.encodedBodySize || 0;
    totalBytes += size;
    const t = r.initiatorType;
    const key = t === "script"
      ? "script"
      : (t === "css" || (t === "link" && r.name.endsWith(".css")))
      ? "css"
      : t === "img"
      ? "img"
      : t === "font" || /\.(woff2?|ttf|otf)(\?|$)/.test(r.name)
      ? "font"
      : t === "fetch" || t === "xmlhttprequest"
      ? "fetch"
      : "other";
    groups[key].count += 1;
    groups[key].bytes += size;
  }

  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const domReady = nav ? Math.round(nav.domContentLoadedEventEnd) : null;
  const loadEvent = nav ? Math.round(nav.loadEventEnd) : null;

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[${group}] Initial Transfer  %c${kb(totalBytes)} / ${resources.length} requests`,
    headerStyle(section),
    "color:#0f172a;font-weight:600",
  );
  // eslint-disable-next-line no-console
  console.table(
    Object.fromEntries(
      Object.entries(groups)
        .filter(([, g]) => g.count > 0)
        .map(([k, g]) => [k, { requests: g.count, size: kb(g.bytes) }]),
    ),
  );
  if (domReady !== null) {
    // eslint-disable-next-line no-console
    console.log(
      `%cDOMContentLoaded%c ${fmt(domReady)}   %cload%c ${loadEvent !== null ? fmt(loadEvent) : "-"}`,
      "color:#7c3aed;font-weight:700", "", "color:#7c3aed;font-weight:700", "",
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
};

/**
 * Summarize resources loaded AFTER a route change (since enteredAt).
 */
const reportRouteTransfer = (snap: RouteSnapshot, exitedAt: number) => {
  if (typeof performance === "undefined" || !performance.getEntriesByType) return;
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  // Only consider resources started after route entry.
  const newRes = resources.filter((r) => r.startTime >= snap.enteredAt);
  const totalBytes = newRes.reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0);

  const buckets: Record<string, { count: number; bytes: number }> = {
    script: { count: 0, bytes: 0 },
    css: { count: 0, bytes: 0 },
    img: { count: 0, bytes: 0 },
    font: { count: 0, bytes: 0 },
    fetch: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };
  for (const r of newRes) {
    const t = r.initiatorType;
    const key = t === "script"
      ? "script"
      : (t === "css" || (t === "link" && r.name.endsWith(".css")))
      ? "css"
      : t === "img"
      ? "img"
      : t === "font" || /\.(woff2?|ttf|otf)(\?|$)/.test(r.name)
      ? "font"
      : t === "fetch" || t === "xmlhttprequest"
      ? "fetch"
      : "other";
    buckets[key].count += 1;
    buckets[key].bytes += (r.transferSize || r.encodedBodySize || 0);
  }

  const dwell = exitedAt - snap.enteredAt;

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[${snap.group}] Route Report  %c${fmt(dwell)} dwell · +${kb(totalBytes)} / ${newRes.length} new requests`,
    headerStyle(snap.section),
    "color:#0f172a;font-weight:600",
  );

  // Vitals for this route
  const rows: Record<string, { value: string }> = {};
  if (snap.softLcp !== null) rows["soft LCP (after route)"] = { value: fmt(snap.softLcp) };
  rows["CLS (after route)"] = { value: snap.cls.toFixed(3) };
  if (snap.inp !== null) rows["INP"] = { value: fmt(snap.inp) };
  // eslint-disable-next-line no-console
  console.table(rows);

  if (newRes.length) {
    // eslint-disable-next-line no-console
    console.table(
      Object.fromEntries(
        Object.entries(buckets)
          .filter(([, g]) => g.count > 0)
          .map(([k, g]) => [k, { requests: g.count, size: kb(g.bytes) }]),
      ),
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
};

/**
 * Observe LCP candidates AFTER initial load so we can approximate a
 * per-route "largest contentful paint" for SPA navigations.
 */
const setupSoftLcpObserver = () => {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const po = new PerformanceObserver((list) => {
      if (!currentRoute) return;
      for (const entry of list.getEntries()) {
        const t = entry.startTime;
        if (t < currentRoute.enteredAt) continue;
        const elapsed = t - currentRoute.enteredAt;
        if (currentRoute.softLcp === null || elapsed > currentRoute.softLcp) {
          currentRoute.softLcp = elapsed;
        }
      }
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // some browsers (Safari < 16) lack LCP observer; ignore
  }

  // Cumulative layout shift after route entry
  try {
    const clsObserver = new PerformanceObserver((list) => {
      if (!currentRoute) return;
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        // @ts-expect-error: layout-shift entries have hadRecentInput/value
        if (entry.hadRecentInput) continue;
        if (entry.startTime < currentRoute.enteredAt) continue;
        // @ts-expect-error
        currentRoute.cls += entry.value || 0;
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
    // ignore
  }

  // INP after route entry (event timing)
  try {
    const evObserver = new PerformanceObserver((list) => {
      if (!currentRoute) return;
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        if (entry.startTime < currentRoute.enteredAt) continue;
        const dur = entry.duration;
        if (currentRoute.inp === null || dur > currentRoute.inp) {
          currentRoute.inp = dur;
        }
      }
    });
    evObserver.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch {
    // ignore
  }
};

/**
 * Public: notify reporter that the SPA route just changed.
 * Should be called from a top-level component on every location change.
 */
export function reportRouteChange(pathname: string) {
  if (!initialized) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (currentRoute && currentRoute.pathname !== pathname) {
    reportRouteTransfer(currentRoute, now);
  }

  if (isFirstLoad) {
    // First load: keep the first snapshot but don't double-report the initial route.
    // Actual initial-load report is fired from initPerfReporter() once 'load' settles.
    isFirstLoad = false;
    currentRoute = newSnapshot(pathname);
    return;
  }

  currentRoute = newSnapshot(pathname);
  // Header marker so dev can see when a new route's measurements begin.
  // eslint-disable-next-line no-console
  console.log(
    `%c→ Route entered%c ${currentRoute.group}`,
    headerStyle(currentRoute.section),
    "color:inherit",
  );
}

export function initPerfReporter() {
  if (initialized) return;

  // In dev, only run when ?perf=1 is set to avoid noise.
  if (import.meta.env.DEV) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("perf") !== "1") return;
    } catch {
      return;
    }
  }

  initialized = true;
  // Seed the first route so soft observers have a baseline
  currentRoute = newSnapshot(typeof window !== "undefined" ? window.location.pathname : "/");
  setupSoftLcpObserver();

  try {
    const wrap = (m: Metric) => {
      const group = currentRoute?.group || routeGroup(window.location.pathname);
      logVital(group, m);
    };
    onFCP(wrap);
    onLCP(wrap);
    onCLS(wrap);
    onINP(wrap);
    onTTFB(wrap);

    const fireInitial = () => {
      if (currentRoute) {
        reportInitialTransfer(currentRoute.group, currentRoute.section);
      }
    };
    if (document.readyState === "complete") {
      setTimeout(fireInitial, 1500);
    } else {
      window.addEventListener("load", () => setTimeout(fireInitial, 1500), { once: true });
    }

    // Report final route on tab close.
    const flush = () => {
      if (currentRoute) {
        const now = performance.now();
        reportRouteTransfer(currentRoute, now);
      }
    };
    window.addEventListener("pagehide", flush, { once: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Perf] reporter failed to initialize:", e);
  }
}
