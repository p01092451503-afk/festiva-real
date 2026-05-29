// Helpers to convert between decimal minutes (DB) and {minutes, seconds} (UI).
import i18n from "@/i18n";

export const toMinSec = (decimalMinutes: number | null | undefined): { m: number; s: number } => {
  if (decimalMinutes == null || isNaN(Number(decimalMinutes))) return { m: 0, s: 0 };
  const totalSeconds = Math.max(0, Math.round(Number(decimalMinutes) * 60));
  return { m: Math.floor(totalSeconds / 60), s: totalSeconds % 60 };
};

export const fromMinSec = (m: number | string, s: number | string): number => {
  const mm = Math.max(0, Number(m) || 0);
  const ss = Math.max(0, Math.min(59, Number(s) || 0));
  // store as decimal minutes with 2 decimals (precision = seconds)
  return Math.round((mm + ss / 60) * 100) / 100;
};

export const formatDurationMs = (decimalMinutes: number | null | undefined): string => {
  const { m, s } = toMinSec(decimalMinutes);
  if (m === 0 && s === 0) return "-";
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const isEn = !!i18n.language?.toLowerCase().startsWith("en");
  if (isEn) return `${mm}m ${ss}s`;
  return `${mm}분 ${ss}초`;
};
