import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PALETTE = [
  "hsl(217 91% 55%)", "hsl(158 64% 42%)", "hsl(38 92% 55%)", "hsl(346 84% 56%)",
  "hsl(271 76% 60%)", "hsl(190 80% 45%)", "hsl(15 85% 60%)", "hsl(120 50% 45%)",
  "hsl(280 70% 55%)", "hsl(40 80% 50%)",
];

interface Row { path: string; count: number; }

export const TopPagesBarChart = ({ data, label }: { data: Row[]; label: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
      <XAxis type="number" tick={{ fontSize: 10 }} />
      <YAxis
        type="category"
        dataKey="path"
        tick={{ fontSize: 10 }}
        width={180}
        tickFormatter={(v: string) => (v.length > 28 ? `…${v.slice(-26)}` : v)}
      />
      <Tooltip
        formatter={(value: number) => [value.toLocaleString(), label]}
        contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
      />
      <Bar dataKey="count" name={label} radius={[0, 6, 6, 0]}>
        {data.map((_, i) => (
          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);