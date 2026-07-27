import { CanonicalRow } from "./types";

function escapeCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return lines.join("\n");
}

const EXPORT_FIELDS: (keyof CanonicalRow)[] = [
  "date",
  "platform",
  "dataSource",
  "appName",
  "os",
  "appVersion",
  "campaign",
  "campaignStatus",
  "country",
  "network",
  "adFormat",
  "currency",
  "spend",
  "impressions",
  "clicks",
  "installs",
  "conversions",
  "platformConversionValue",
  "adRevenue",
  "iapRevenue",
  "subscriptionRevenue",
  "adImpressions",
  "users",
  "newUsers",
  "dau",
  "mau",
  "crashes",
  "crashFreeUsers",
];

export function rowsToCsv(rows: CanonicalRow[]): string {
  return toCsv(
    EXPORT_FIELDS as string[],
    rows.map((row) => EXPORT_FIELDS.map((f) => row[f] as string | number | undefined))
  );
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
