import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

export const LevelRadial = ({ data }: { data: { value: number; fill: string }[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
    </RadialBarChart>
  </ResponsiveContainer>
);

export const BadgeRadial = ({ data }: { data: { value: number; fill: string }[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
    </RadialBarChart>
  </ResponsiveContainer>
);

export const PointsTrendArea = ({ data, pointsLabel = "포인트" }: { data: { week: string; points: number }[]; pointsLabel?: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
      <defs>
        <linearGradient id="pointsGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
      <Tooltip
        contentStyle={{
          backgroundColor: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "8px",
          fontSize: "12px",
        }}
        labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
      />
      <Area type="monotone" dataKey="points" name={pointsLabel} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#pointsGradient)" />
    </AreaChart>
  </ResponsiveContainer>
);

export const CategoryProgressBar = ({ data, progressLabel = "진도" }: { data: { category: string; value: number }[]; progressLabel?: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
      <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
      <YAxis type="category" dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={120} />
      <Tooltip
        contentStyle={{
          backgroundColor: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "8px",
          fontSize: "12px",
        }}
        formatter={(v: number) => [`${v}%`, progressLabel]}
      />
      <Bar dataKey="value" barSize={12} radius={[0, 6, 6, 0]}>
        {data.map((entry, idx) => (
          <Cell
            key={idx}
            fill={
              entry.value >= 80
                ? "hsl(var(--success))"
                : entry.value >= 60
                ? "hsl(var(--warning))"
                : "hsl(var(--info))"
            }
          />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);