import type { QueryClient } from "@tanstack/react-query";

/**
 * Lightweight localStorage persistence for a small allow-list of *global*
 * queries (site settings, nav items, feature flags, demo preset).
 *
 * Why: these four queries run on every single page and each round-trip to the
 * backend costs 300–500ms. Because they are read on first render, the header,
 * sidebar and footer cannot paint until they resolve — that is the bulk of the
 * perceived "slow page load".
 *
 * Hydrating them synchronously from localStorage lets the UI paint instantly on
 * repeat visits, while React Query still refetches in the background so data
 * stays fresh.
 */
const STORAGE_KEY = "rq-global-cache-v1";
const MAX_AGE = 24 * 60 * 60 * 1000; // 1 day

/** Query keys (first segment) that are safe to persist — no user-specific data. */
const PERSISTED_KEYS = new Set([
  "site-settings",
  "nav-items",
  "feature-modules",
  "demo-preset-active",
  "main-page-blocks",
  "categories-active",
]);

type Entry = { key: unknown[]; data: unknown; ts: number };

const shouldPersist = (key: readonly unknown[]) =>
  typeof key[0] === "string" && PERSISTED_KEYS.has(key[0] as string);

export function hydrateQueryCache(client: QueryClient) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries: Entry[] = JSON.parse(raw);
    const now = Date.now();
    entries.forEach((e) => {
      if (!Array.isArray(e.key) || now - e.ts > MAX_AGE) return;
      if (!shouldPersist(e.key)) return;
      // Seed the cache with a stale timestamp so a background refetch still runs.
      client.setQueryData(e.key, e.data, { updatedAt: e.ts });
    });
  } catch {
    // Corrupt payload or storage unavailable — ignore.
  }
}

export function persistQueryCache(client: QueryClient) {
  let timer: number | undefined;

  const flush = () => {
    try {
      const entries: Entry[] = client
        .getQueryCache()
        .getAll()
        .filter((q) => shouldPersist(q.queryKey) && q.state.status === "success")
        .map((q) => ({
          key: q.queryKey as unknown[],
          data: q.state.data,
          ts: q.state.dataUpdatedAt,
        }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Quota exceeded / private mode — non-fatal.
    }
  };

  client.getQueryCache().subscribe(() => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(flush, 1000);
  });
}
