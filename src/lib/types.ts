// Canonical data model for the KPI dashboard.
// A field that is not present in an uploaded source stays `undefined`.
// `undefined` (unavailable) must never be treated the same as `0` (valid zero).

export type PlatformSource =
  | "google_ads"
  | "admob"
  | "axon"
  | "applovin"
  | "game_analytics"
  | "firebase"
  | "meta_ads"
  | "generic";

export const PLATFORM_LABELS: Record<PlatformSource, string> = {
  google_ads: "Google Ads",
  admob: "AdMob",
  axon: "Axon",
  applovin: "AppLovin",
  game_analytics: "GameAnalytics",
  firebase: "Firebase Analytics",
  meta_ads: "Meta Ads",
  generic: "Generic CSV",
};

// Stable colors per platform, reused everywhere (legends, bars, badges).
export const PLATFORM_COLORS: Record<PlatformSource, string> = {
  google_ads: "#4285F4",
  admob: "#0F9D58",
  axon: "#7C3AED",
  applovin: "#F97316",
  game_analytics: "#EC4899",
  firebase: "#FFCA28",
  meta_ads: "#1877F2",
  generic: "#64748B",
};

export interface CanonicalDimensions {
  date?: string; // ISO yyyy-MM-dd
  platform?: PlatformSource;
  dataSource?: string; // raw source label as reported by the file
  account?: string;
  appName?: string;
  appId?: string;
  os?: string;
  appVersion?: string;
  campaign?: string;
  campaignId?: string;
  campaignStatus?: string;
  adSet?: string;
  adSetId?: string;
  ad?: string;
  adId?: string;
  country?: string;
  region?: string;
  network?: string;
  adFormat?: string;
  placement?: string;
  device?: string;
  currency?: string;
  attributionWindow?: string;
}

export interface AcquisitionMetrics {
  spend?: number;
  impressions?: number;
  clicks?: number;
  installs?: number;
  conversions?: number;
  viewThroughConversions?: number;
  inAppActions?: number;
}

export interface MonetizationMetrics {
  adRevenue?: number;
  iapRevenue?: number;
  subscriptionRevenue?: number;
  platformConversionValue?: number;
  adImpressions?: number;
  matchedRequests?: number;
  adRequests?: number;
}

export interface EngagementMetrics {
  users?: number;
  newUsers?: number;
  activeUsers?: number;
  dau?: number;
  wau?: number;
  mau?: number;
  sessions?: number;
  sessionDuration?: number;
  retainedUsersD1?: number;
  eligibleNewUsersD1?: number;
  retainedUsersD7?: number;
  eligibleNewUsersD7?: number;
  retainedUsersD30?: number;
  eligibleNewUsersD30?: number;
  crashes?: number;
  crashFreeUsers?: number;
}

export interface CanonicalRow
  extends CanonicalDimensions,
    AcquisitionMetrics,
    MonetizationMetrics,
    EngagementMetrics {
  id: string;
  fileId: string;
  isDemo?: boolean;
  raw?: Record<string, string>;
}

export type FieldCategory =
  | "dimension"
  | "acquisition"
  | "monetization"
  | "engagement";

export type FieldDataType = "string" | "number" | "date" | "currency" | "percent";

export interface CanonicalFieldDefinition {
  id: string;
  label: string;
  category: FieldCategory;
  dataType: FieldDataType;
  required?: boolean;
  description?: string;
}

export type ImportStatus =
  | "pending"
  | "parsing"
  | "needs_mapping"
  | "imported"
  | "partial"
  | "error";

export interface ParsedTable {
  titleRow?: string;
  dateRangeText?: string;
  detectedDateRange?: { start: string; end: string };
  headerRowIndex: number;
  headers: string[];
  rows: string[][];
  footerRows: string[][];
  blankRowCount: number;
}

export interface MappingSuggestion {
  sourceColumn: string;
  targetField: string | null; // canonical field id, null = unmapped/ignored
  confidence: number; // 0-100
  sampleValues: string[];
  dataType: FieldDataType;
  ignored?: boolean;
}

export interface ColumnMapping {
  [sourceColumn: string]: {
    targetField: string | null;
    confidence: number;
    ignored: boolean;
  };
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  platform: PlatformSource;
  status: ImportStatus;
  detectedCurrency?: string;
  detectedDateRange?: { start: string; end: string };
  recordCount: number;
  importedRecordCount: number;
  skippedRecordCount: number;
  parsedTable?: ParsedTable;
  mapping?: ColumnMapping;
  mappingSuggestions?: MappingSuggestion[];
  issues: DataQualityIssue[];
  uploadedAt: string;
  error?: string;
}

export type IssueSeverity = "error" | "warning" | "info";

export interface DataQualityIssue {
  id: string;
  severity: IssueSeverity;
  category: string;
  description: string;
  suggestedResolution: string;
  sourceFile: string;
  rowNumber?: number;
  resolved?: boolean;
}

export interface DateRange {
  start: string; // ISO yyyy-MM-dd
  end: string;
}

export interface DashboardFilters {
  platforms: PlatformSource[];
  dataSources: string[];
  campaigns: string[];
  countries: string[];
  os: string[];
  appVersions: string[];
  networks: string[];
  adFormats: string[];
  campaignStatuses: string[];
  currencies: string[];
  dateRange: DateRange | null;
  comparePeriod: DateRange | null;
  reportingCurrency: string;
}

export interface SavedFilterView {
  id: string;
  name: string;
  filters: DashboardFilters;
}

export type Granularity = "daily" | "weekly" | "monthly";

export interface AggregateTotals {
  spend?: number;
  adRevenue?: number;
  iapRevenue?: number;
  subscriptionRevenue?: number;
  totalRevenue?: number;
  platformConversionValue?: number;
  impressions?: number;
  clicks?: number;
  installs?: number;
  conversions?: number;
  viewThroughConversions?: number;
  inAppActions?: number;
  adImpressions?: number;
  matchedRequests?: number;
  adRequests?: number;
  users?: number;
  newUsers?: number;
  activeUsers?: number;
  dau?: number;
  mau?: number;
  sessions?: number;
  retainedUsersD1?: number;
  eligibleNewUsersD1?: number;
  retainedUsersD7?: number;
  eligibleNewUsersD7?: number;
  retainedUsersD30?: number;
  eligibleNewUsersD30?: number;
  crashes?: number;
  crashFreeUsers?: number;
  rowCount: number;
}
