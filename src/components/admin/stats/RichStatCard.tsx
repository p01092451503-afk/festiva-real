import { LucideIcon, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type StatTone =
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "sky"
  | "teal"
  | "fuchsia"
  | "slate";

export const TONE_BG: Record<StatTone, string> = {
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export const TONE_BAR: Record<StatTone, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
  fuchsia: "bg-fuchsia-500",
  slate: "bg-slate-500",
};

/** Tiny SVG donut ring, currentColor-driven for theme-friendly tone */
export const Ring = ({
  value,
  tone,
  size = 36,
}: {
  value: number;
  tone: StatTone;
  size?: number;
}) => {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={TONE_BG[tone].split(" ").slice(1).join(" ")}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
};

/** Tiny vertical sparkline */
export const Sparkline = ({
  values,
  tone,
}: {
  values: number[];
  tone: StatTone;
}) => {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-0.5 h-7" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-sm opacity-80", TONE_BAR[tone])}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
};

/** Discrete dots indicator (e.g. streak/tally) */
export const Dots = ({
  active,
  total = 7,
  tone,
}: {
  active: number;
  total?: number;
  tone: StatTone;
}) => (
  <div className="flex items-center gap-0.5" aria-hidden="true">
    {Array.from({ length: total }).map((_, i) => (
      <span
        key={i}
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          i < active ? TONE_BAR[tone] : "bg-muted",
        )}
      />
    ))}
  </div>
);

export type RichStatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: StatTone;
  href?: string;
  /** Optional inline visualization */
  visual?: "ring" | "bar" | "sparkline" | "dots" | "none";
  ringValue?: number;
  barValue?: number;
  barCaption?: string;
  sparklineValues?: number[];
  dotsActive?: number;
  dotsTotal?: number;
  className?: string;
};

/**
 * Visualized stat card used across admin/teacher dashboards.
 * Combines an icon-tone badge, big value, helper sub-text and an
 * optional micro-visualization (ring / bar / sparkline / dots).
 */
export const RichStatCard = ({
  label,
  value,
  sub,
  icon: Icon,
  tone = "indigo",
  href,
  visual = "none",
  ringValue,
  barValue,
  barCaption,
  sparklineValues,
  dotsActive,
  dotsTotal,
  className,
}: RichStatCardProps) => {
  const baseClass =
    "relative rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-sm transition-all";

  const content = (
    <div className="relative h-full flex flex-col justify-between gap-3">
      {/* Top: icon + label */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-lg shrink-0",
              TONE_BG[tone],
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-tight truncate font-medium">
            {label}
          </span>
        </div>
        {href && (
          <ArrowRight
            className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-1.5"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Middle: value + visual */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground leading-none tabular-nums tracking-tight whitespace-nowrap truncate">
            {value}
          </p>
          {sub && (
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 truncate">
              {sub}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {visual === "ring" && (
            <Ring value={ringValue ?? 0} tone={tone} />
          )}
          {visual === "sparkline" && (
            <Sparkline
              values={sparklineValues?.length ? sparklineValues : [3, 5, 2, 6, 4, 7, 5]}
              tone={tone}
            />
          )}
          {visual === "dots" && (
            <Dots active={dotsActive ?? 0} total={dotsTotal ?? 7} tone={tone} />
          )}
        </div>
      </div>

      {/* Bottom: bar */}
      {visual === "bar" && (
        <div className="space-y-1">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
              style={{
                width: `${Math.min(100, Math.max(0, barValue ?? 0))}%`,
              }}
            />
          </div>
          {barCaption && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {barCaption}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        to={href}
        className={cn(
          baseClass,
          "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn(baseClass, className)}>{content}</div>;
};

export default RichStatCard;