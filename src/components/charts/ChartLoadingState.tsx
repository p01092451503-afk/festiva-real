import { useTranslation } from "react-i18next";

interface ChartLoadingStateProps {
  /** Optional override for the main label (e.g. "차트 데이터 불러오는 중"). */
  label?: string;
  /** Optional override for the secondary description. */
  description?: string;
  /** Container height — default matches the typical chart panel. */
  height?: string;
}

/**
 * Friendly loading indicator for chart panels.
 * Shows shimmering bar placeholders + a soft message so the empty space
 * never feels like an error while data is being fetched/aggregated.
 */
const ChartLoadingState = ({ label, description, height = "h-[260px]" }: ChartLoadingStateProps) => {
  const { t } = useTranslation();
  const heading = label ?? t("common.chartLoading", "차트를 불러오는 중입니다");

  // Minimal, calm chart skeleton — just the essential structure of a chart
  // (axis rail, gridlines, bars, baseline). One subtle shimmer sweep across
  // the whole panel; no per-element animations.
  const yTicks = [0, 1, 2, 3]; // 4 horizontal gridlines
  const bars = [38, 56, 48, 70, 60, 78, 66, 84];

  return (
    <div
      className={`relative w-full ${height} rounded-xl border border-border/50 bg-card overflow-hidden`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={heading}
    >
      {/* Y-axis tick rail */}
      <div className="absolute left-3 top-6 bottom-10 w-5 flex flex-col justify-between" aria-hidden="true">
        {yTicks.map((i) => (
          <span key={i} className="block h-[6px] w-4 rounded-sm bg-muted-foreground/10 ml-auto" />
        ))}
      </div>

      {/* Plot area */}
      <div className="absolute left-10 right-5 top-6 bottom-10" aria-hidden="true">
        {/* Horizontal gridlines */}
        {yTicks.map((i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-border/30"
            style={{ top: `${(i / (yTicks.length - 1)) * 100}%` }}
          />
        ))}

        {/* Bars — flat muted fill, no per-bar animation */}
        <div className="absolute inset-0 flex items-end justify-between gap-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-muted-foreground/15"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* X-axis baseline */}
      <div className="absolute left-10 right-5 bottom-10 h-px bg-border/60" aria-hidden="true" />

      {/* X-axis tick labels */}
      <div className="absolute left-10 right-5 bottom-4 flex justify-between" aria-hidden="true">
        {bars.map((_, i) => (
          <span key={i} className="h-[6px] w-5 rounded-sm bg-muted-foreground/10" />
        ))}
      </div>

      {/* Single subtle shimmer sweep across the entire panel */}
      <div
        className="pointer-events-none absolute inset-0 animate-shimmer bg-no-repeat bg-[length:200%_100%]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, hsl(var(--foreground) / 0.04) 50%, transparent 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default ChartLoadingState;