import { AggregateTotals } from "./types";

// null = N/A (denominator zero/unavailable). Never coerce to 0.
export function safeDiv(
  numerator: number | undefined,
  denominator: number | undefined,
  multiplier = 1
): number | null {
  if (numerator === undefined || denominator === undefined) return null;
  if (denominator === 0) return null;
  return (numerator / denominator) * multiplier;
}

export interface ComputedMetrics {
  spend: number | null;
  adRevenue: number | null;
  iapRevenue: number | null;
  subscriptionRevenue: number | null;
  totalRevenue: number | null;
  platformConversionValue: number | null;
  profit: number | null;
  profitMargin: number | null;
  ctr: number | null;
  cpi: number | null;
  cpc: number | null;
  cpm: number | null;
  roasTotal: number | null;
  roasAd: number | null;
  roasIap: number | null;
  roasPlatform: number | null;
  conversionRate: number | null;
  ipm: number | null;
  arpu: number | null;
  arpdau: number | null;
  ecpm: number | null;
  fillRate: number | null;
  matchRate: number | null;
  dauMau: number | null;
  d1Retention: number | null;
  d7Retention: number | null;
  d30Retention: number | null;
  crashFreeRate: number | null;
  installs: number | null;
  impressions: number | null;
  clicks: number | null;
  users: number | null;
  dau: number | null;
}

export function computeMetrics(t: AggregateTotals): ComputedMetrics {
  const totalRevenue =
    t.adRevenue === undefined && t.iapRevenue === undefined && t.subscriptionRevenue === undefined
      ? null
      : (t.adRevenue ?? 0) + (t.iapRevenue ?? 0) + (t.subscriptionRevenue ?? 0);

  const profit =
    totalRevenue === null || t.spend === undefined ? null : totalRevenue - t.spend;

  return {
    spend: t.spend ?? null,
    adRevenue: t.adRevenue ?? null,
    iapRevenue: t.iapRevenue ?? null,
    subscriptionRevenue: t.subscriptionRevenue ?? null,
    totalRevenue,
    platformConversionValue: t.platformConversionValue ?? null,
    profit,
    profitMargin: totalRevenue && totalRevenue !== 0 ? safeDiv(profit ?? undefined, totalRevenue, 100) : null,
    ctr: safeDiv(t.clicks, t.impressions, 100),
    cpi: safeDiv(t.spend, t.installs),
    cpc: safeDiv(t.spend, t.clicks),
    cpm: safeDiv(t.spend, t.impressions, 1000),
    roasTotal: totalRevenue === null ? null : safeDiv(totalRevenue, t.spend),
    roasAd: safeDiv(t.adRevenue, t.spend),
    roasIap: safeDiv(t.iapRevenue, t.spend),
    roasPlatform: safeDiv(t.platformConversionValue, t.spend),
    conversionRate: safeDiv(t.conversions, t.clicks, 100),
    ipm: safeDiv(t.installs, t.impressions, 1000),
    arpu: totalRevenue === null ? null : safeDiv(totalRevenue, t.users),
    arpdau: totalRevenue === null ? null : safeDiv(totalRevenue, t.dau),
    ecpm: safeDiv(t.adRevenue, t.adImpressions, 1000),
    fillRate: safeDiv(t.adImpressions, t.matchedRequests, 100),
    matchRate: safeDiv(t.matchedRequests, t.adRequests, 100),
    dauMau: safeDiv(t.dau, t.mau, 100),
    d1Retention: safeDiv(t.retainedUsersD1, t.eligibleNewUsersD1, 100),
    d7Retention: safeDiv(t.retainedUsersD7, t.eligibleNewUsersD7, 100),
    d30Retention: safeDiv(t.retainedUsersD30, t.eligibleNewUsersD30, 100),
    crashFreeRate: safeDiv(t.crashFreeUsers, t.activeUsers, 100),
    installs: t.installs ?? null,
    impressions: t.impressions ?? null,
    clicks: t.clicks ?? null,
    users: t.users ?? null,
    dau: t.dau ?? null,
  };
}

// Metrics where a decrease is the positive direction (cost efficiency metrics).
export const LOWER_IS_BETTER = new Set([
  "spend",
  "cpi",
  "cpc",
  "cpm",
  "crashes",
]);

export function statusForChange(
  metricKey: string,
  change: number | null
): "positive" | "negative" | "neutral" {
  if (change === null || change === 0) return "neutral";
  const lowerIsBetter = LOWER_IS_BETTER.has(metricKey);
  if (lowerIsBetter) return change < 0 ? "positive" : "negative";
  return change > 0 ? "positive" : "negative";
}
