/**
 * Shared Recharts tooltip presentation tokens.
 * Use across every chart so hover popovers feel consistent and premium.
 */
export const sharedTooltipContentStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border) / 0.6)",
  background: "hsl(var(--popover) / 0.98)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  boxShadow:
    "0 8px 24px -8px hsl(var(--foreground) / 0.18), 0 2px 6px -2px hsl(var(--foreground) / 0.08)",
  padding: "8px 10px",
  fontSize: 12,
  lineHeight: 1.4,
  color: "hsl(var(--popover-foreground))",
};

export const sharedTooltipLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "hsl(var(--muted-foreground))",
  marginBottom: 4,
};

export const sharedTooltipItemStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "hsl(var(--popover-foreground))",
  padding: 0,
};

export const sharedBarCursor = {
  fill: "hsl(var(--muted) / 0.4)",
  radius: 6,
};

export const sharedLineCursor = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 3",
};