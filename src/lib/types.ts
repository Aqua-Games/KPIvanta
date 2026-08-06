// Canonical data model.
// Rule that governs the whole app: a metric that a source does not report stays
// `undefined`. `undefined` (unavailable) is never rendered or aggregated as `0`.

export type SourceId =
  | "gameanalytics"
  | "admob"
  | "firebase"
  | "google_play"
  | "app_store"
  | "applovin"
  | "unity_ads"
  | "generic";

export const SOURCE_LABELS: Record<SourceId, string> = {
  gameanalytics: "GameAnalytics",
  admob: "AdMob",
  firebase: "Firebase",
  google_play: "Google Play Console",
  app_store: "App Store Connect",
  applovin: "AppLovin",
  unity_ads: "Unity Ads",
  generic: "Generic CSV",
};

export const SOURCE_COLORS: Record<SourceId, string> = {
  gameanalytics: "#EC4899",
  admob: "#0F9D58",
  firebase: "#F59E0B",
  google_play: "#34A853",
  app_store: "#0EA5E9",
  applovin: "#F97316",
  unity_ads: "#111827",
  generic: "#64748B",
};

/** Which report shape a file was recognised as. Drives the transform used. */
export type ReportKind =
  | "retention_by_day" // Date + Retention 1..N columns
  | "metric_by_build" // Date + "<Metric> <build>" columns (DAU 2.0, Playtime per user 1.9)
  | "metric_by_country" // Date + "<Metric> <CC>" columns (Retention US, Retention JP)
  | "ad_performance_by_app" // one row per app, no date (AdMob export)
  | "long_format" // already one row per date/dimension combination
  | "unknown";

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  retention_by_day: "Retention by day (D1–D7)",
  metric_by_build: "Metric split by build",
  metric_by_country: "Metric split by country",
  ad_performance_by_app: "Ad performance by app",
  long_format: "Row-per-record report",
  unknown: "Unrecognised layout",
};

/* ------------------------------------------------------------------ */
/* Canonical record                                                    */
/* ------------------------------------------------------------------ */

export interface KpiRecordDimensions {
  date?: string; // ISO yyyy-MM-dd. Undefined only for period-level rows.
  periodStart?: string; // for rows that describe a range rather than a day
  periodEnd?: string;
  week?: string; // ISO week key, e.g. "2026-W30"
  game?: string;
  build?: string; // app / build version, e.g. "2.0"
  platform?: string; // iOS / Android
  country?: string;
  source: SourceId;
  /** Every source that contributed to this record once complementary rows merge. */
  sources?: SourceId[];
  currency?: string;
}

export interface KpiRecordMetrics {
  // Engagement
  dau?: number;
  activeUsers?: number;
  newUsers?: number;
  sessions?: number;
  playtimeSecondsPerUser?: number;
  playtimeSecondsTotal?: number;

  // Retention — stored as rates (0-100) plus cohort size when the source has it.
  retentionD1?: number;
  retentionD2?: number;
  retentionD3?: number;
  retentionD4?: number;
  retentionD5?: number;
  retentionD6?: number;
  retentionD7?: number;
  retentionD30?: number;
  cohortSize?: number;

  // Acquisition
  spend?: number;

  // Monetization
  adRevenue?: number;
  iapRevenue?: number;
  adImpressions?: number;
  adRequests?: number;
  matchedRequests?: number;
  adClicks?: number;
  adViewers?: number;
  dav?: number; // daily ad viewers

  // Stability
  crashes?: number;
  crashedUsers?: number;
  anrs?: number;
  crashRate?: number; // when a source reports the rate directly
  anrRate?: number;

  // Progression
  levelStarts?: number;
  levelCompletions?: number;
}

export interface KpiRecord extends KpiRecordDimensions, KpiRecordMetrics {
  id: string;
  uploadId: string;
  isDemo?: boolean;
}

export type MetricKey = keyof KpiRecordMetrics;

/* ------------------------------------------------------------------ */
/* Canonical field catalogue (used by the column-mapping UI)           */
/* ------------------------------------------------------------------ */

export type FieldCategory =
  | "dimension"
  | "engagement"
  | "retention"
  | "monetization"
  | "stability"
  | "progression";

export type FieldDataType = "string" | "number" | "date" | "currency" | "rate";

export interface CanonicalFieldDefinition {
  id: string;
  label: string;
  category: FieldCategory;
  dataType: FieldDataType;
  description: string;
  /** Rates arriving as 0–1 fractions are scaled to 0–100 on import. */
  isRate?: boolean;
}

/* ------------------------------------------------------------------ */
/* Import pipeline                                                     */
/* ------------------------------------------------------------------ */

export type ImportStatus =
  | "parsing"
  | "needs_review"
  | "needs_period"
  | "imported"
  | "partial"
  | "duplicate"
  | "error";

export interface ParsedTable {
  encoding: string;
  delimiter: string;
  titleRows: string[];
  dateRangeText?: string;
  detectedPeriod?: { start: string; end: string };
  headerRowIndex: number;
  headers: string[];
  rows: string[][];
  footerRows: string[][];
  blankRowCount: number;
}

export interface ColumnPlan {
  sourceColumn: string;
  /** Canonical field id, or null when unmapped. */
  targetField: string | null;
  /** Build/version extracted from a wide column header, e.g. "DAU 2.0" -> "2.0". */
  build?: string;
  /** Country code extracted from a wide column header, e.g. "Retention US" -> "US". */
  country?: string;
  /** Retention day index extracted from "Retention 3" -> 3. */
  retentionDay?: number;
  confidence: number; // 0-100
  ignored: boolean;
  dataType: FieldDataType;
  sampleValues: string[];
  /** True when values look like 0–1 fractions that represent percentages. */
  fractionRate?: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  contentHash: string;
  source: SourceId;
  reportKind: ReportKind;
  status: ImportStatus;
  game?: string;
  platform?: string;
  country?: string;
  build?: string;
  currency?: string;
  period?: { start: string; end: string };
  recordCount: number;
  importedRecordCount: number;
  skippedRecordCount: number;
  parsedTable?: ParsedTable;
  plan?: ColumnPlan[];
  issues: ValidationIssue[];
  uploadedAt: string;
  error?: string;
}

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  category: string;
  description: string;
  resolution: string;
  sourceFile: string;
  rowNumber?: number;
  excluded?: boolean;
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export interface DateRange {
  start: string;
  end: string;
}

export interface Filters {
  games: string[];
  platforms: string[];
  countries: string[];
  builds: string[];
  sources: string[];
  weeks: string[];
  dateRange: DateRange | null;
  compareRange: DateRange | null;
}

export interface SavedView {
  id: string;
  name: string;
  filters: Filters;
}

export type Granularity = "daily" | "weekly" | "monthly";

/** How a metric change should be read. */
export type MetricDirection = "higher_better" | "lower_better";
