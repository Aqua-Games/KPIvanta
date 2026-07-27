import { KpiRecord } from "./types";

function escapeCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");
}

export function download(filename: string, content: string, type = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const RECORD_COLUMNS: (keyof KpiRecord)[] = [
  "date",
  "week",
  "game",
  "build",
  "platform",
  "country",
  "source",
  "currency",
  "dau",
  "newUsers",
  "sessions",
  "playtimeSecondsPerUser",
  "retentionD1",
  "retentionD3",
  "retentionD7",
  "adRevenue",
  "iapRevenue",
  "adImpressions",
  "adRequests",
  "matchedRequests",
  "adClicks",
  "crashes",
  "anrs",
  "levelStarts",
  "levelCompletions",
];

export function exportRecordsCsv(records: KpiRecord[], filename: string) {
  const csv = toCsv(
    RECORD_COLUMNS as string[],
    records.map((r) => RECORD_COLUMNS.map((c) => r[c] as string | number | undefined))
  );
  download(filename, csv);
}
