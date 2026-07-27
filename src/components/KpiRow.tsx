"use client";

import { useMemo } from "react";
import { Granularity, KpiRecord, SOURCE_LABELS, SourceId } from "@/lib/types";
import { KPI_BY_ID, KpiId, changeStatus, kpisFor, percentChange } from "@/lib/kpi";
import { completeness, timeSeries } from "@/lib/select";
import { KpiCard } from "./KpiCard";

/** Which record field backs each KPI, for the completeness indicator. */
const BACKING_FIELD: Partial<Record<KpiId, keyof KpiRecord>> = {
  dau: "dau",
  playtimePerUserSeconds: "playtimeSecondsPerUser",
  sessionsPerUser: "sessions",
  retentionD1: "retentionD1",
  retentionD3: "retentionD3",
  retentionD7: "retentionD7",
  arpdau: "adRevenue",
  arpdauAds: "adRevenue",
  arpdauIap: "iapRevenue",
  impdau: "adImpressions",
  ecpm: "adRevenue",
  totalRevenue: "adRevenue",
  adRevenue: "adRevenue",
  iapRevenue: "iapRevenue",
  crashRate: "crashes",
  anrRate: "anrs",
  levelCompletionRate: "levelCompletions",
  matchRate: "matchedRequests",
  showRate: "adImpressions",
  ctr: "adClicks",
};

export function KpiRow({
  metrics,
  records,
  compareRecords,
  granularity,
  currency,
  columns = 4,
}: {
  metrics: KpiId[];
  records: KpiRecord[];
  compareRecords: KpiRecord[];
  granularity: Granularity;
  currency: string;
  columns?: 3 | 4;
}) {
  const current = useMemo(() => kpisFor(records), [records]);
  const previous = useMemo(() => kpisFor(compareRecords), [compareRecords]);
  const series = useMemo(() => timeSeries(records, granularity), [records, granularity]);

  const sourcesInScope = useMemo(() => {
    const set = new Set(records.map((r) => r.source));
    return Array.from(set)
      .map((s) => SOURCE_LABELS[s as SourceId] ?? s)
      .join(", ");
  }, [records]);

  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 ${
        columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
      }`}
    >
      {metrics.map((id) => {
        const definition = KPI_BY_ID[id];
        if (!definition) return null;
        const value = current[id];
        const comparison = previous[id];
        const change = percentChange(value, comparison);
        const field = BACKING_FIELD[id];

        return (
          <KpiCard
            key={id}
            definition={definition}
            value={value}
            comparisonValue={comparison}
            percentChange={change}
            status={changeStatus(id, change)}
            currency={currency}
            completeness={field ? completeness(records, field) : 100}
            sourceLabel={sourcesInScope || "No data in scope"}
            note={
              id.startsWith("retention") && current.retentionUnweighted
                ? "The retention export carries no cohort size, so days are weighted equally."
                : undefined
            }
            sparkline={series.map((point) => ({
              bucket: point.bucket,
              value: point[id],
            }))}
          />
        );
      })}
    </div>
  );
}
