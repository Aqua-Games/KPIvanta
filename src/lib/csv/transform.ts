import { v4 as uuid } from "uuid";
import {
  ColumnPlan,
  KpiRecord,
  ParsedTable,
  ReportKind,
  SourceId,
  ValidationIssue,
} from "../types";
import { isMissingCell, parseDate, parseNumber } from "./values";
import { FIELD_BY_ID } from "./fields";
import { daysBetween, isoWeekKey } from "../week";

/**
 * Fields a period report states as a total for the whole period. When such a
 * report has no daily breakdown, these are divided evenly across the days so
 * per-day KPIs (ARPDAU, IMPDAU) are not inflated by the period length.
 */
const PERIOD_TOTAL_FIELDS = new Set([
  "adRevenue",
  "iapRevenue",
  "adImpressions",
  "adRequests",
  "matchedRequests",
  "adClicks",
  "adViewers",
  "activeUsers",
  "newUsers",
  "sessions",
  "playtimeSecondsTotal",
  "crashes",
  "crashedUsers",
  "anrs",
  "levelStarts",
  "levelCompletions",
]);

/** Fields a period report already states as a per-day average — left untouched. */
const DAILY_AVERAGE_FIELDS = new Set(["dau", "dav", "playtimeSecondsPerUser"]);

export interface TransformContext {
  uploadId: string;
  fileName: string;
  source: SourceId;
  reportKind: ReportKind;
  /** Defaults applied to every row when the file itself carries no such column. */
  game?: string;
  platform?: string;
  country?: string;
  build?: string;
  currency?: string;
  period?: { start: string; end: string };
  /**
   * Expand a dateless period report into one record per day, distributing
   * period totals evenly. Set for reports such as the AdMob weekly export.
   */
  spreadAcrossPeriod?: boolean;
}

export interface TransformResult {
  records: KpiRecord[];
  issues: ValidationIssue[];
  skipped: number;
}

let issueSeq = 0;
const nextIssueId = () => `vi-${++issueSeq}-${Math.floor(performance.now() % 100000)}`;

function setMetric(
  target: Record<string, unknown>,
  field: string,
  rawValue: string,
  plan: ColumnPlan
) {
  const definition = FIELD_BY_ID[field];
  if (!definition) return;

  if (definition.dataType === "date") {
    const parsed = parseDate(rawValue);
    if (parsed) target[field] = parsed;
    return;
  }
  if (definition.dataType === "string") {
    if (!isMissingCell(rawValue)) target[field] = rawValue.trim();
    return;
  }

  const value = parseNumber(rawValue);
  if (value === undefined) return; // missing stays missing — never coerced to 0

  // Rates land on a single 0-100 scale regardless of how the source expressed them.
  if (definition.isRate && plan.fractionRate && !rawValue.includes("%")) {
    target[field] = value * 100;
    return;
  }
  target[field] = value;
}

export function transform(
  table: ParsedTable,
  plan: ColumnPlan[],
  context: TransformContext
): TransformResult {
  const issues: ValidationIssue[] = [];
  const records: KpiRecord[] = [];
  let skipped = 0;

  const active = plan.filter((p) => !p.ignored && p.targetField);
  const dateColumn = plan.findIndex((p) => p.targetField === "date");
  const buildColumns = active.filter((p) => p.build);
  const isWide = context.reportKind === "metric_by_build" && buildColumns.length > 0;
  const spread =
    (context.spreadAcrossPeriod ?? context.reportKind === "ad_performance_by_app") &&
    dateColumn < 0 &&
    Boolean(context.period);

  table.rows.forEach((row, rowIndex) => {
    const lineNumber = table.headerRowIndex + rowIndex + 2;

    const date = dateColumn >= 0 ? parseDate(row[dateColumn] ?? "") : undefined;
    // A file without dates (an AdMob export) is stamped with the period the user supplies.
    const effectiveDate = date ?? context.period?.end;

    if (!effectiveDate) {
      skipped++;
      issues.push({
        id: nextIssueId(),
        severity: "error",
        category: "Invalid date",
        description: `Row ${lineNumber} has no usable date and no reporting period was supplied.`,
        resolution: "Map a date column, or set the report period on the import card.",
        sourceFile: context.fileName,
        rowNumber: lineNumber,
      });
      return;
    }

    const baseDimensions = {
      uploadId: context.uploadId,
      source: context.source,
      date: effectiveDate,
      week: isoWeekKey(effectiveDate),
      game: context.game,
      platform: context.platform,
      country: context.country,
      build: context.build,
      currency: context.currency,
      periodStart: context.period?.start,
      periodEnd: context.period?.end,
    };

    if (isWide) {
      // One output record per build present on this row.
      const byBuild = new Map<string, Record<string, unknown>>();
      const shared: Record<string, unknown> = {};

      plan.forEach((column, columnIndex) => {
        if (column.ignored || !column.targetField || column.targetField === "date") return;
        const raw = row[columnIndex] ?? "";
        if (isMissingCell(raw)) return;

        if (column.build) {
          const bucket = byBuild.get(column.build) ?? {};
          setMetric(bucket, column.targetField, raw, column);
          byBuild.set(column.build, bucket);
        } else {
          setMetric(shared, column.targetField, raw, column);
        }
      });

      if (byBuild.size === 0) {
        skipped++;
        return;
      }

      byBuild.forEach((metrics, build) => {
        if (Object.keys(metrics).length === 0) return;
        records.push({
          id: uuid(),
          ...baseDimensions,
          ...shared,
          ...metrics,
          build,
        } as KpiRecord);
      });
      return;
    }

    const record: Record<string, unknown> = { id: uuid(), ...baseDimensions };
    let hasMetric = false;

    plan.forEach((column, columnIndex) => {
      if (column.ignored || !column.targetField) return;
      const raw = row[columnIndex] ?? "";
      if (isMissingCell(raw)) return;
      const before = Object.keys(record).length;
      setMetric(record, column.targetField, raw, column);
      if (Object.keys(record).length > before && column.targetField !== "date") hasMetric = true;
    });

    if (!hasMetric) {
      skipped++;
      return;
    }

    // A per-row game/build/country column overrides the file-level default,
    // because setMetric writes those ids straight onto the record.
    if (spread && context.period) {
      records.push(...spreadRecord(record, context.period));
    } else {
      records.push(record as unknown as KpiRecord);
    }
  });

  if (spread && context.period && records.length > 0) {
    issues.push({
      id: nextIssueId(),
      severity: "info",
      category: "Period distributed across days",
      description: `${context.fileName} reports one row per app for ${context.period.start} to ${context.period.end} with no daily breakdown. Period totals were divided evenly across the ${dayCountOf(context.period)} days.`,
      resolution:
        "Upload a daily export if day-level accuracy matters. Period-level KPIs remain correct either way.",
      sourceFile: context.fileName,
    });
  }

  return { records, issues, skipped };
}

function dayCountOf(period: { start: string; end: string }): number {
  return Math.max(1, daysBetween(period.start, period.end) + 1);
}

/** One record per day: period totals divided, per-day averages left as they are. */
function spreadRecord(
  record: Record<string, unknown>,
  period: { start: string; end: string }
): KpiRecord[] {
  const days = dayCountOf(period);
  const out: KpiRecord[] = [];
  const start = new Date(period.start + "T00:00:00Z");

  for (let i = 0; i < days; i++) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const date = day.toISOString().slice(0, 10);
    const copy: Record<string, unknown> = { ...record, id: uuid(), date, week: isoWeekKey(date) };

    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== "number") continue;
      if (DAILY_AVERAGE_FIELDS.has(key)) continue;
      if (PERIOD_TOTAL_FIELDS.has(key)) copy[key] = value / days;
    }
    out.push(copy as unknown as KpiRecord);
  }
  return out;
}

/** Distinct dimension values present in a set of records, sorted naturally. */
export function distinct(records: KpiRecord[], key: keyof KpiRecord): string[] {
  const set = new Set<string>();
  for (const record of records) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    set.add(String(value));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
