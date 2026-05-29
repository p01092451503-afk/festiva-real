import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import {
  sharedTooltipContentStyle,
  sharedTooltipLabelStyle,
  sharedTooltipItemStyle,
  sharedBarCursor,
  sharedLineCursor,
} from "./tooltipStyles";

interface DailyData {
  date: string;
  views: number;
  access: number;
  bytesGB: number;
}

interface LineProps {
  data: DailyData[];
  isMobile: boolean;
  pageViewLabel: string;
  lessonAccessLabel: string;
}

export const TrafficLineChart = ({ data, isMobile, pageViewLabel, lessonAccessLabel }: LineProps) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={isMobile ? { top: 8, right: 4, left: 0, bottom: 0 } : { top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} minTickGap={isMobile ? 24 : 12} />
      <YAxis tick={{ fontSize: 10 }} width={35} hide={isMobile} />
      <Tooltip
        contentStyle={sharedTooltipContentStyle}
        labelStyle={sharedTooltipLabelStyle}
        itemStyle={sharedTooltipItemStyle}
        cursor={sharedLineCursor}
        formatter={(value: number, name: string) => [value.toLocaleString(), name]}
      />
      <Line type="monotone" dataKey="views" name={pageViewLabel} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="access" name={lessonAccessLabel} stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

interface BarProps {
  data: DailyData[];
  isMobile: boolean;
  transferLabel: string;
}

export const TrafficBarChart = ({ data, isMobile, transferLabel }: BarProps) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={isMobile ? { top: 8, right: 4, left: 0, bottom: 0 } : { top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={8} minTickGap={isMobile ? 24 : 12} />
      <YAxis tick={{ fontSize: 10 }} width={35} hide={isMobile} />
      <Tooltip
        contentStyle={sharedTooltipContentStyle}
        labelStyle={sharedTooltipLabelStyle}
        itemStyle={sharedTooltipItemStyle}
        cursor={sharedBarCursor}
        formatter={(value: number) => [`${value} GB`, ""]}
      />
      <Bar dataKey="bytesGB" name={transferLabel} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);