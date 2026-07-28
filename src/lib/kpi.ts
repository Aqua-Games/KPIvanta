import { KpiRecord, MetricDirection } from "./types";
import {
  formatCompactNumber,
  formatCurrencyPrecise,
  formatDecimal,
  formatMinutes,
  formatPercent,
} from "./format";

/* ------------------------------------------------------------------ */
/* Safe division                                                       */
/* ------------------------------------------------------------------ */

/** null means "not available" — a zero or missing denominator never yields 0. */
export function safeDiv(
  numerator: number | undefined,
  denominator: number | undefined,
  multiplier = 1
): number | null {
  if (numerator === undefined || denominator === undefined) return null;
  if (denominator === 0) return null;
  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : null;
}

/* ------------------------------------------------------------------ */
/* Additive totals                                                     */
/* ------------------------------------------------------------------ */

/** Metrics that can be summed across rows. Rates are deliberately excluded. */
export const ADDITIVE_FIELDS = [
  "dau",
  "activeUsers",
  "newUsers",
  "sessions",
  "playtimeSecondsTotal",
  "adRevenue",
  "iapRevenue",
  "adImpressions",
  "adRequests",
  "matchedRequests",
  "adClicks",
  "adViewers",
  "dav",
  "crashes",
  "crashedUsers",
  "anrs",
  "levelStarts",
  "levelCompletions",
  "cohortSize",
] as const;

export type AdditiveField = (typeof ADDITIVE_FIELDS)[number];

/** Retention arrives as a rate. Weighted by cohort size when the source has one. */
export const RETENTION_FIELDS = [
  "retentionD1",
  "retentionD2",
  "retentionD3",
  "retentionD4",
  "retentionD5",
  "retentionD6",
  "retentionD7",
  "retentionD30",
] as const;

export type RetentionField = (typeof RETENTION_FIELDS)[number];

export interface Totals extends Partial<Record<AdditiveField, number>> {
  rowCount: number;
  /** Per retention day: weighted sum and total weight, so the mean stays correct. */
  retention: Partial<Record<RetentionField, { weightedSum: number; weight: number; samples: number }>>;
  /** True when at least one retention value had no cohort size to weight by. */
  retentionUnweighted: boolean;
  /** Rates reported directly by a source (crash rate, ANR rate) with their weights. */
  crashRateWeighted?: { weightedSum: number; weight: number };
  anrRateWeighted?: { weightedSum: number; weight: number };
  days: Set<string>;
}

export function emptyTotals(): Totals {
  return { rowCount: 0, retention: {}, retentionUnweighted: false, days: new Set() };
}

export function accumulate(totals: Totals, record: KpiRecord): Totals {
  totals.rowCount += 1;
  if (record.date) totals.days.add(record.date);

  for (const field of ADDITIVE_FIELDS) {
    const value = record[field];
    if (value === undefined || Number.isNaN(value)) continue;
    totals[field] = (totals[field] ?? 0) + value;
  }

  // Playtime: sources report seconds per user. Reconstruct the total so the
  // aggregate is a true weighted average rather than an average of averages.
  if (record.playtimeSecondsTotal === undefined && record.playtimeSecondsPerUser !== undefined) {
    const users = record.dau ?? record.activeUsers;
    if (users !== undefined) {
      totals.playtimeSecondsTotal =
        (totals.playtimeSecondsTotal ?? 0) + record.playtimeSecondsPerUser * users;
    }
  }

  for (const field of RETENTION_FIELDS) {
    const rate = record[field];
    if (rate === undefined || Number.isNaN(rate)) continue;
    const weight = record.cohortSize ?? record.newUsers ?? record.dau;
    const effectiveWeight = weight ?? 1;
    if (weight === undefined) totals.retentionUnweighted = true;
    const bucket = totals.retention[field] ?? { weightedSum: 0, weight: 0, samples: 0 };
    bucket.weightedSum += rate * effectiveWeight;
    bucket.weight += effectiveWeight;
    bucket.samples += 1;
    totals.retention[field] = bucket;
  }

  if (record.crashRate !== undefined) {
    const weight = record.sessions ?? record.dau ?? 1;
    const bucket = totals.crashRateWeighted ?? { weightedSum: 0, weight: 0 };
    bucket.weightedSum += record.crashRate * weight;
    bucket.weight += weight;
    totals.crashRateWeighted = bucket;
  }
  if (record.anrRate !== undefined) {
    const weight = record.sessions ?? record.dau ?? 1;
    const bucket = totals.anrRateWeighted ?? { weightedSum: 0, weight: 0 };
    bucket.weightedSum += record.anrRate * weight;
    bucket.weight += weight;
    totals.anrRateWeighted = bucket;
  }

  return totals;
}

export function aggregate(records: KpiRecord[]): Totals {
  const totals = emptyTotals();
  for (const record of records) accumulate(totals, record);
  return totals;
}

/* ------------------------------------------------------------------ */
/* Derived KPI values                                                  */
/* ------------------------------------------------------------------ */

export interface KpiValues {
  dau: number | null; // average DAU across the days in scope
  dauTotal: number | null;
  activeUsers: number | null;
  newUsers: number | null;
  sessions: number | null;
  sessionsPerUser: number | null;
  playtimePerUserSeconds: number | null;
  playtimeTotalHours: number | null;
  retentionD1: number | null;
  retentionD2: number | null;
  retentionD3: number | null;
  retentionD4: number | null;
  retentionD5: number | null;
  retentionD6: number | null;
  retentionD7: number | null;
  adRevenue: number | null;
  iapRevenue: number | null;
  totalRevenue: number | null;
  arpdau: number | null;
  arpdauAds: number | null;
  arpdauIap: number | null;
  adImpressions: number | null;
  impdau: number | null;
  ecpm: number | null;
  matchRate: number | null;
  showRate: number | null;
  ctr: number | null;
  adViewerRate: number | null;
  crashRate: number | null;
  anrRate: number | null;
  crashFreeRate: number | null;
  levelCompletionRate: number | null;
  dayCount: number;
  retentionUnweighted: boolean;
}

function retentionValue(totals: Totals, field: RetentionField): number | null {
  const bucket = totals.retention[field];
  if (!bucket || bucket.weight === 0) return null;
  return bucket.weightedSum / bucket.weight;
}

export function computeKpis(totals: Totals): KpiValues {
  const dayCount = totals.days.size;
  // DAU is a daily figure: summing it across days would be meaningless, so the
  // headline value is the mean across the days actually present in the data.
  const avgDau = dayCount > 0 && totals.dau !== undefined ? totals.dau / dayCount : null;

  const adRevenue = totals.adRevenue;
  const iapRevenue = totals.iapRevenue;
  const totalRevenue =
    adRevenue === undefined && iapRevenue === undefined
      ? null
      : (adRevenue ?? 0) + (iapRevenue ?? 0);

  const crashRate =
    totals.crashRateWeighted && totals.crashRateWeighted.weight > 0
      ? totals.crashRateWeighted.weightedSum / totals.crashRateWeighted.weight
      : safeDiv(totals.crashes, totals.sessions, 100);

  const anrRate =
    totals.anrRateWeighted && totals.anrRateWeighted.weight > 0
      ? totals.anrRateWeighted.weightedSum / totals.anrRateWeighted.weight
      : safeDiv(totals.anrs, totals.sessions, 100);

  return {
    dau: avgDau,
    dauTotal: totals.dau ?? null,
    activeUsers: totals.activeUsers ?? null,
    newUsers: totals.newUsers ?? null,
    sessions: totals.sessions ?? null,
    sessionsPerUser: safeDiv(totals.sessions, totals.dau),
    playtimePerUserSeconds: safeDiv(totals.playtimeSecondsTotal, totals.dau),
    playtimeTotalHours:
      totals.playtimeSecondsTotal === undefined ? null : totals.playtimeSecondsTotal / 3600,
    retentionD1: retentionValue(totals, "retentionD1"),
    retentionD2: retentionValue(totals, "retentionD2"),
    retentionD3: retentionValue(totals, "retentionD3"),
    retentionD4: retentionValue(totals, "retentionD4"),
    retentionD5: retentionValue(totals, "retentionD5"),
    retentionD6: retentionValue(totals, "retentionD6"),
    retentionD7: retentionValue(totals, "retentionD7"),
    adRevenue: adRevenue ?? null,
    iapRevenue: iapRevenue ?? null,
    totalRevenue,
    arpdau: totalRevenue === null ? null : safeDiv(totalRevenue, totals.dau),
    arpdauAds: safeDiv(totals.adRevenue, totals.dau),
    arpdauIap: safeDiv(totals.iapRevenue, totals.dau),
    adImpressions: totals.adImpressions ?? null,
    impdau: safeDiv(totals.adImpressions, totals.dau),
    ecpm: safeDiv(totals.adRevenue, totals.adImpressions, 1000),
    matchRate: safeDiv(totals.matchedRequests, totals.adRequests, 100),
    showRate: safeDiv(totals.adImpressions, totals.matchedRequests, 100),
    ctr: safeDiv(totals.adClicks, totals.adImpressions, 100),
    adViewerRate: safeDiv(totals.adViewers, totals.activeUsers, 100),
    crashRate,
    anrRate,
    crashFreeRate: crashRate === null ? null : 100 - crashRate,
    levelCompletionRate: safeDiv(totals.levelCompletions, totals.levelStarts, 100),
    dayCount,
    retentionUnweighted: totals.retentionUnweighted,
  };
}

export function kpisFor(records: KpiRecord[]): KpiValues {
  return computeKpis(aggregate(records));
}

/* ------------------------------------------------------------------ */
/* KPI catalogue — one definition drives cards, tables and comparisons  */
/* ------------------------------------------------------------------ */

export type KpiId = keyof Omit<KpiValues, "dayCount" | "retentionUnweighted">;

export interface KpiDefinition {
  id: KpiId;
  label: string;
  shortLabel?: string;
  group: "engagement" | "retention" | "monetization" | "stability" | "progression";
  formula: string;
  direction: MetricDirection;
  format: (value: number | null, currency?: string) => string;
  /** Excluded from the composite performance score when false. */
  scored?: boolean;
  scoreWeight?: number;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: "dau",
    label: "DAU",
    group: "engagement",
    formula: "Sum of daily active users ÷ number of days in the selected period",
    direction: "higher_better",
    format: (v) => formatCompactNumber(v),
    scored: true,
    scoreWeight: 1,
  },
  {
    id: "playtimePerUserSeconds",
    label: "Playtime / User",
    group: "engagement",
    formula: "Total playtime seconds ÷ DAU (per-user seconds are re-expanded to totals before dividing)",
    direction: "higher_better",
    format: (v) => formatMinutes(v),
    scored: true,
    scoreWeight: 1,
  },
  {
    id: "sessionsPerUser",
    label: "Sessions / User",
    group: "engagement",
    formula: "Total sessions ÷ DAU",
    direction: "higher_better",
    format: (v) => formatDecimal(v, 2),
    scored: true,
    scoreWeight: 0.5,
  },
  {
    id: "retentionD1",
    label: "D1 Retention",
    group: "retention",
    formula: "Day-1 retained users ÷ eligible cohort, weighted by cohort size",
    direction: "higher_better",
    format: (v) => formatPercent(v),
    scored: true,
    scoreWeight: 1.5,
  },
  {
    id: "retentionD2",
    label: "D2 Retention",
    group: "retention",
    formula: "Day-2 retained users ÷ eligible cohort, weighted by cohort size",
    direction: "higher_better",
    format: (v) => formatPercent(v),
  },
  {
    id: "retentionD3",
    label: "D3 Retention",
    group: "retention",
    formula: "Day-3 retained users ÷ eligible cohort, weighted by cohort size",
    direction: "higher_better",
    format: (v) => formatPercent(v),
    scored: true,
    scoreWeight: 1.25,
  },
  {
    id: "retentionD4",
    label: "D4 Retention",
    group: "retention",
    formula: "Day-4 retained users ÷ eligible cohort, weighted by cohort size",
    direction: "higher_better",
    format: (v) => formatPercent(v),
  },
  {
    id: "retentionD5",
    label: "D5 Retention",
    group: "retention",
    formula: "Day-5 retained users ÷ eligible cohort, weighted by cohort size",
    direction: "higher_better",
    format: (v) => formatPercent(v),
  },
  {
    id: "retentionD6",
    label: "D6 Retention",
    group: "retention",
    formula: "Day-6 retained users ÷ eligible cohort, weighted by cohort size",
    direction: "higher_better",
    format: (v) => formatPercent(v),
  },
  {
    id: "retentionD7",
    label: "D7 Retention",
    group: "retention",
    formula: "Day-7 retained users ÷ eligible cohort, weighted by cohort size",
    direction: "higher_better",
    format: (v) => formatPercent(v),
    scored: true,
    scoreWeight: 1.5,
  },
  {
    id: "arpdau",
    label: "ARPDAU",
    group: "monetization",
    formula: "(Ad revenue + IAP revenue) ÷ DAU",
    direction: "higher_better",
    format: (v, c) => formatCurrencyPrecise(v, c, 4),
    scored: true,
    scoreWeight: 1.5,
  },
  {
    id: "arpdauAds",
    label: "ARPDAU Ads",
    group: "monetization",
    formula: "Ad revenue ÷ DAU",
    direction: "higher_better",
    format: (v, c) => formatCurrencyPrecise(v, c, 4),
    scored: true,
    scoreWeight: 1,
  },
  {
    id: "arpdauIap",
    label: "ARPDAU IAP",
    group: "monetization",
    formula: "In-app purchase revenue ÷ DAU",
    direction: "higher_better",
    format: (v, c) => formatCurrencyPrecise(v, c, 4),
    scored: true,
    scoreWeight: 1,
  },
  {
    id: "impdau",
    label: "IMPDAU",
    group: "monetization",
    formula: "Ad impressions ÷ DAU",
    direction: "higher_better",
    format: (v) => formatDecimal(v, 2),
    scored: true,
    scoreWeight: 1,
  },
  {
    id: "ecpm",
    label: "eCPM",
    group: "monetization",
    formula: "Ad revenue ÷ ad impressions × 1,000",
    direction: "higher_better",
    format: (v, c) => formatCurrencyPrecise(v, c, 2),
  },
  {
    id: "totalRevenue",
    label: "Revenue",
    group: "monetization",
    formula: "Ad revenue + IAP revenue",
    direction: "higher_better",
    format: (v, c) => formatCurrencyPrecise(v, c, 2),
    scored: true,
    scoreWeight: 1,
  },
  {
    id: "adRevenue",
    label: "Ad Revenue",
    group: "monetization",
    formula: "Sum of verified advertising revenue",
    direction: "higher_better",
    format: (v, c) => formatCurrencyPrecise(v, c, 2),
  },
  {
    id: "iapRevenue",
    label: "IAP Revenue",
    group: "monetization",
    formula: "Sum of in-app purchase revenue",
    direction: "higher_better",
    format: (v, c) => formatCurrencyPrecise(v, c, 2),
  },
  {
    id: "matchRate",
    label: "Match Rate",
    group: "monetization",
    formula: "Matched requests ÷ ad requests × 100",
    direction: "higher_better",
    format: (v) => formatPercent(v),
  },
  {
    id: "showRate",
    label: "Show Rate",
    group: "monetization",
    formula: "Ad impressions ÷ matched requests × 100",
    direction: "higher_better",
    format: (v) => formatPercent(v),
  },
  {
    id: "ctr",
    label: "Ad CTR",
    group: "monetization",
    formula: "Ad clicks ÷ ad impressions × 100",
    direction: "higher_better",
    format: (v) => formatPercent(v),
  },
  {
    id: "crashRate",
    label: "Crash Rate",
    group: "stability",
    formula: "Crashes ÷ sessions × 100 (or the rate reported by the source, weighted by sessions)",
    direction: "lower_better",
    format: (v) => formatPercent(v, 2),
    scored: true,
    scoreWeight: 1.25,
  },
  {
    id: "anrRate",
    label: "ANR Rate",
    group: "stability",
    formula: "ANRs ÷ sessions × 100 (or the rate reported by the source, weighted by sessions)",
    direction: "lower_better",
    format: (v) => formatPercent(v, 2),
    scored: true,
    scoreWeight: 1,
  },
  {
    id: "levelCompletionRate",
    label: "Level Completion",
    group: "progression",
    formula: "Users completing the level ÷ users who started it × 100",
    direction: "higher_better",
    format: (v) => formatPercent(v),
    scored: true,
    scoreWeight: 1,
  },
];

export const KPI_BY_ID: Record<string, KpiDefinition> = Object.fromEntries(
  KPI_DEFINITIONS.map((d) => [d.id, d])
);

export function formatKpi(id: KpiId, value: number | null, currency = "USD"): string {
  const def = KPI_BY_ID[id];
  return def ? def.format(value, currency) : formatDecimal(value);
}

/* ------------------------------------------------------------------ */
/* Change / direction helpers                                          */
/* ------------------------------------------------------------------ */

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function absoluteChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

export type ChangeStatus = "improved" | "worse" | "same" | "unknown";

/** `neutralBand` is the ± percentage inside which a change counts as unchanged. */
export function changeStatus(
  id: KpiId,
  change: number | null,
  neutralBand = 2
): ChangeStatus {
  if (change === null) return "unknown";
  if (Math.abs(change) < neutralBand) return "same";
  const def = KPI_BY_ID[id];
  const higherBetter = def ? def.direction === "higher_better" : true;
  if (higherBetter) return change > 0 ? "improved" : "worse";
  return change < 0 ? "improved" : "worse";
}
