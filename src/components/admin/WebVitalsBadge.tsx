import { useEffect, useState } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { Activity, ChevronDown, ChevronUp, X } from "lucide-react";
import { useLocation } from "react-router-dom";

type MetricName = "FCP" | "LCP" | "CLS" | "INP" | "TTFB";
type Rating = "good" | "needs-improvement" | "poor";

interface VitalState {
  value: number;
  rating: Rating;
}

const STORAGE_KEY_HIDDEN = "webVitalsBadge.hidden";
const STORAGE_KEY_COLLAPSED = "webVitalsBadge.collapsed";

const ORDER: MetricName[] = ["FCP", "LCP", "CLS", "INP", "TTFB"];

const ratingClass = (r?: Rating) => {
  if (r === "good") return "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
  if (r === "needs-improvement") return "bg-amber-500 text-white dark:bg-amber-500 dark:text-white border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
  if (r === "poor") return "bg-rose-500 text-white dark:bg-rose-500 dark:text-white border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
  return "bg-muted text-muted-foreground border-border";
};

const fmt = (name: MetricName, value: number) => {
  if (name === "CLS") return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
};

export default function WebVitalsBadge() {
  const location = useLocation();
  const [vitals, setVitals] = useState<Partial<Record<MetricName, VitalState>>>({});
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_HIDDEN);
      // Default to hidden (collapsed icon badge) on first load.
      if (stored === null) return true;
      return stored === "1";
    } catch {
      return true;
    }
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY_COLLAPSED) === "1"; } catch { return false; }
  });

  // Subscribe to web-vitals once. Library handles dedup and final reporting.
  useEffect(() => {
    const handler = (m: Metric) => {
      setVitals((prev) => ({
        ...prev,
        [m.name as MetricName]: { value: m.value, rating: m.rating as Rating },
      }));
    };
    try {
      onFCP(handler);
      onLCP(handler);
      onCLS(handler);
      onINP(handler);
      onTTFB(handler);
    } catch {
      // ignore
    }
  }, []);

  // Reset transient metrics on route change so each page gets fresh CLS/INP.
  // (FCP/LCP/TTFB are first-load only and cannot be re-measured per SPA route.)
  useEffect(() => {
    setVitals((prev) => {
      const next = { ...prev };
      delete next.CLS;
      delete next.INP;
      return next;
    });
  }, [location.pathname]);

  const toggleHidden = (next: boolean) => {
    setHidden(next);
    try { sessionStorage.setItem(STORAGE_KEY_HIDDEN, next ? "1" : "0"); } catch { /* noop */ }
  };
  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    try { sessionStorage.setItem(STORAGE_KEY_COLLAPSED, next ? "1" : "0"); } catch { /* noop */ }
  };

  if (hidden) {
    return (
      <button
        onClick={() => toggleHidden(false)}
        className="fixed bottom-4 right-4 z-[60] h-9 w-9 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Web Vitals 배지 표시"
        title="Web Vitals"
      >
        <Activity className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg text-xs"
      role="status"
      aria-label="Web Vitals 실시간 측정"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border">
        <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="font-semibold text-foreground">Web Vitals</span>
        <button
          onClick={() => toggleCollapsed(!collapsed)}
          className="ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label={collapsed ? "펼치기" : "접기"}
          title={collapsed ? "펼치기" : "접기"}
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => toggleHidden(true)}
          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
          aria-label="숨기기"
          title="숨기기"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!collapsed && (
        <div className="p-2 flex flex-wrap gap-1.5 max-w-[320px]">
          {ORDER.map((name) => {
            const v = vitals[name];
            return (
              <span
                key={name}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[11px] ${ratingClass(v?.rating)}`}
                title={v ? `${name}: ${fmt(name, v.value)} (${v.rating})` : `${name}: 측정 대기 중`}
              >
                <span className="font-semibold">{name}</span>
                <span>{v ? fmt(name, v.value) : "—"}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
