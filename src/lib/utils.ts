import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPrice = (price: number): string =>
  price === 0 ? '무료' : price.toLocaleString('ko-KR') + '원';

export const formatDurationMinutes = (minutes: number): string => {
  const totalSeconds = Math.max(0, Math.round((Number(minutes) || 0) * 60));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  if (s > 0 && h === 0) parts.push(`${s}초`);
  return parts.length ? parts.join(' ') : '0분';
};

export const formatDateKo = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
