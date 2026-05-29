import { useEffect, useRef, useState } from "react";

/**
 * Polls /version.json at a fixed interval and on tab focus to detect when a
 * new build has been deployed. Useful for installed PWAs where the cached
 * shell can otherwise keep running an old bundle indefinitely.
 *
 * Returns `true` once the server-side version differs from the version that
 * was active when this tab first loaded.
 */
export function useAppVersionCheck(intervalMs = 5 * 60 * 1000): {
  hasUpdate: boolean;
  reload: () => void;
} {
  const [hasUpdate, setHasUpdate] = useState(false);
  const initialVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchVersion = async (): Promise<string | null> => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { version?: string };
        return data.version ?? null;
      } catch {
        return null;
      }
    };

    const check = async () => {
      const v = await fetchVersion();
      if (cancelled || !v) return;
      if (initialVersionRef.current === null) {
        initialVersionRef.current = v;
        return;
      }
      if (v !== initialVersionRef.current) {
        setHasUpdate(true);
      }
    };

    // Initial baseline + periodic polling.
    check();
    const id = window.setInterval(check, intervalMs);

    // Re-check whenever the user returns to the tab (covers PWA resume).
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  const reload = () => {
    // Hard reload to bypass any stale HTTP cache the PWA might be holding.
    window.location.reload();
  };

  return { hasUpdate, reload };
}