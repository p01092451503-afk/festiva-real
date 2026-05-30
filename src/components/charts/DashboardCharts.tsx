import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
} from "recharts";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border) / 0.6)",
  background: "hsl(var(--popover) / 0.98)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  boxShadow: "0 8px 24px -8px hsl(var(--foreground) / 0.18), 0 2px 6px -2px hsl(var(--foreground) / 0.08)",
  padding: "8px 10px",
  fontSize: 12,
  lineHeight: 1.4,
  color: "hsl(var(--popover-foreground))",
};

const tooltipLabelStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: "hsl(var(--muted-foreground))",
  marginBottom: 4,
};

const tooltipItemStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: "hsl(var(--popover-foreground))",
  padding: 0,
};

/** Premium tooltip used by donut/pie charts. Shows a color swatch, name,
 * value and percentage of total in a compact, polished card. */
const DonutTooltipContent = ({
  active,
  payload,
  total,
  unit = "",
}: {
  active?: boolean;
  payload?: any[];
  total: number;
  unit?: string;
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = Number(item.value) || 0;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const color = item.payload?.color || item.color || "hsl(var(--primary))";
  return (
    <div
      style={tooltipStyle}
      className="min-w-[140px]"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: color }}
          aria-hidden="true"
        />
        <span className="text-[11px] font-medium text-muted-foreground truncate">
          {item.name}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-foreground tabular-nums">
          {value.toLocaleString()}{unit}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
          {pct}%
        </span>
      </div>
    </div>
  );
};

/* ──────────────── Sparkline (KPI 카드 내부) ──────────────── */
export const Sparkline = ({
  data,
  color = "hsl(var(--primary))",
  height = 36,
}: {
  data: { v: number }[];
  color?: string;
  height?: number;
}) => (
  <div style={{ width: "100%", height }} aria-hidden="true">
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

/* ──────────────── Trend Area (가입/수료/접속 등 추세선) ──────────────── */
export const TrendAreaChart = ({
  data,
  dataKey = "value",
  xKey = "date",
  color = "hsl(var(--primary))",
  unit = "",
  height = 200,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  unit?: string;
  height?: number;
}) => (
  <div style={{ width: "100%", height }}>
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(v: number) => [`${v.toLocaleString()}${unit}`, ""]}
          cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill="url(#trend-grad)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

/* ──────────────── Bar Chart (강의별 / 분포) ──────────────── */
export const SimpleBarChart = ({
  data,
  dataKey = "value",
  xKey = "name",
  color = "hsl(var(--primary))",
  height = 220,
  showLabel = false,
  unit = "",
  vertical = false,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  height?: number;
  showLabel?: boolean;
  unit?: string;
  vertical?: boolean;
}) => (
  <div style={{ width: "100%", height }}>
    <ResponsiveContainer>
      <BarChart
        data={data}
        layout={vertical ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, left: vertical ? 8 : -8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} stroke="hsl(var(--border))" width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 50 : 30} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} width={32} />
          </>
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(v: number) => [`${v.toLocaleString()}${unit}`, ""]}
          cursor={{ fill: "hsl(var(--muted) / 0.4)", radius: 6 }}
        />
        <defs>
          {data.map((_, i) => (
            <linearGradient key={`bargrad-${i}`} id={`bargrad-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={`hsl(var(--foreground) / ${i % 2 === 0 ? 0.18 : 0.28})`} />
              <stop offset="100%" stopColor={`hsl(var(--foreground) / ${i % 2 === 0 ? 0.95 : 0.75})`} />
            </linearGradient>
          ))}
        </defs>
        <Bar dataKey={dataKey} radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={24}>
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={`url(#bargrad-${i})`} />
          ))}
          {showLabel && <LabelList dataKey={dataKey} position={vertical ? "right" : "top"} style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

/* ──────────────── Donut (역할/상태 비율) ──────────────── */
const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

export const DonutChart = ({
  data,
  height = 200,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" paddingAngle={2} stroke="hsl(var(--background))" strokeWidth={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color || DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            wrapperStyle={{ zIndex: 50, outline: "none" }}
            position={{ x: 0, y: 0 }}
            allowEscapeViewBox={{ x: true, y: true }}
            content={<DonutTooltipContent total={total} />}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
          {centerValue && <span className="text-xl font-bold text-foreground leading-none">{centerValue}</span>}
          {centerLabel && <span className="text-[11px] text-muted-foreground mt-1">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
};

/* ──────────────── Progress Distribution (0~25, 26~50, 51~75, 76~100) ──────────────── */
export const ProgressBucketChart = ({
  enrollments,
  height = 200,
}: {
  enrollments: { progress: number | null }[];
  height?: number;
}) => {
  const buckets = [
    // Blue progression — light → deep — to convey progress maturity
    { name: "0-25%", value: 0, color: "hsl(213 94% 78%)" },
    { name: "26-50%", value: 0, color: "hsl(217 91% 65%)" },
    { name: "51-75%", value: 0, color: "hsl(221 83% 53%)" },
    { name: "76-100%", value: 0, color: "hsl(224 76% 40%)" },
  ];
  enrollments.forEach((e) => {
    const p = Number(e.progress) || 0;
    if (p <= 25) buckets[0].value++;
    else if (p <= 50) buckets[1].value++;
    else if (p <= 75) buckets[2].value++;
    else buckets[3].value++;
  });
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={buckets} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} width={32} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            cursor={{ fill: "hsl(var(--muted) / 0.4)", radius: 6 }}
            formatter={(v: number) => [`${v}건`, ""]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {buckets.map((b, i) => (
              <Cell key={i} fill={b.color} />
            ))}
            <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
