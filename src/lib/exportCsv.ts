/**
 * Excel-friendly CSV export (UTF-8 BOM + CRLF) — opens correctly in Korean Excel.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const escapeCell = (raw: string | number | null | undefined) => {
  const value = raw === null || raw === undefined ? "" : String(raw);
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  return "\uFEFF" + [head, ...body].join("\r\n");
}

export function downloadCsv<T>(fileName: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = buildCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const todayStamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
