import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { date: string; amount: number }[];
}

const B2cRevenueChart = ({ data }: Props) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={6} stroke="hsl(var(--muted-foreground))" />
      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} stroke="hsl(var(--muted-foreground))" />
      <Tooltip
        formatter={(value: number) => [`${value.toLocaleString()}원`, "매출"]}
        contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
      />
      <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

export default B2cRevenueChart;