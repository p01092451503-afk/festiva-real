const KOREA_TIME_ZONE = "Asia/Seoul";
const KOREA_UTC_OFFSET_HOURS = 9;

const dateTimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const koreaDateTimeLocalToDbTimestamp = (value: string) => {
  const match = dateTimeLocalPattern.exec(value);
  if (!match) return value;

  return `${value}:00+09:00`;
};

export const koreaDateTimeLocalToUtcIso = (value: string) => {
  const match = dateTimeLocalPattern.exec(value);
  if (!match) return new Date(value).toISOString();

  const [, year, month, day, hour, minute] = match;
  const utcTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - KOREA_UTC_OFFSET_HOURS,
    Number(minute),
    0,
    0,
  );

  return new Date(utcTime).toISOString();
};

export const koreaDateTimeLocalToTime = (value: string) =>
  new Date(koreaDateTimeLocalToUtcIso(value)).getTime();

export const formatKoreaDateTime = (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  }).format(typeof value === "string" ? new Date(value) : value);

export const formatKoreaTime = (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(typeof value === "string" ? new Date(value) : value);