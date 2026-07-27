import { Filters, Granularity, KpiRecord } from "./types";
import { KpiValues, aggregate, computeKpis } from "./kpi";
import { isoWeekKey, monthKey } from "./week";

function matches(value: string | undefined, selection: string[]): boolean {
  if (selection.length === 0) return true;
  if (value === undefined) return false;
  return selection.includes(value);
}

export function inRange(date: string | undefined, range: Filters["dateRange"]): boolean {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

/** A merged record matches a source filter when any contributing source matches. */
function matchesSource(record: KpiRecord, selection: string[]): boolean {
  if (selection.length === 0) return true;
  const sources = record.sources ?? [record.source];
  return sources.some((s) => selection.includes(s));
}

export function applyFilters(records: KpiRecord[], filters: Filters): KpiRecord[] {
  return records.filter(
    (r) =>
      inRange(r.date, filters.dateRange) &&
      matches(r.game, filters.games) &&
      matches(r.platform, filters.platforms) &&
      matches(r.country, filters.countries) &&
      matches(r.build, filters.builds) &&
      matchesSource(r, filters.sources) &&
      matches(r.week, filters.weeks)
  );
}

export function groupBy<K extends keyof KpiRecord>(
  records: KpiRecord[],
  key: K
): Map<string, KpiRecord[]> {
  const map = new Map<string, KpiRecord[]>();
  for (const record of records) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    const bucket = map.get(String(value));
    if (bucket) bucket.push(record);
    else map.set(String(value), [record]);
  }
  return map;
}

export interface Group extends KpiValues {
  key: string;
  records: KpiRecord[];
}

export function groupedKpis<K extends keyof KpiRecord>(
  records: KpiRecord[],
  key: K
): Group[] {
  return Array.from(groupBy(records, key).entries())
    .map(([groupKey, groupRecords]) => ({
      key: groupKey,
      records: groupRecords,
      ...computeKpis(aggregate(groupRecords)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

export function bucketKey(date: string, granularity: Granularity): string {
  if (granularity === "daily") return date;
  if (granularity === "monthly") return monthKey(date) + "-01";
  return isoWeekKey(date);
}

export interface SeriesPoint extends KpiValues {
  bucket: string;
  label: string;
}

export function timeSeries(
  records: KpiRecord[],
  granularity: Granularity
): SeriesPoint[] {
  const buckets = new Map<string, KpiRecord[]>();
  for (const record of records) {
    if (!record.date) continue;
    const key = bucketKey(record.date, granularity);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(record);
    else buckets.set(key, [record]);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, bucketRecords]) => ({
      bucket,
      label: bucket,
      ...computeKpis(aggregate(bucketRecords)),
    }));
}

export function distinctValues<K extends keyof KpiRecord>(
  records: KpiRecord[],
  key: K
): string[] {
  const set = new Set<string>();
  for (const record of records) {
    if (key === "source") {
      (record.sources ?? [record.source]).forEach((s) => set.add(s));
      continue;
    }
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    set.add(String(value));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function dataDateRange(records: KpiRecord[]): { start: string; end: string } | null {
  let min: string | undefined;
  let max: string | undefined;
  for (const record of records) {
    if (!record.date) continue;
    if (!min || record.date < min) min = record.date;
    if (!max || record.date > max) max = record.date;
  }
  return min && max ? { start: min, end: max } : null;
}

/** Share of records in scope that actually carry a value for the field. */
export function completeness(records: KpiRecord[], field: keyof KpiRecord): number {
  if (records.length === 0) return 0;
  let present = 0;
  for (const record of records) {
    if (record[field] !== undefined && record[field] !== null) present++;
  }
  return (present / records.length) * 100;
}
