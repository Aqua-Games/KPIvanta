"use client";

import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { useStore } from "@/store/useStore";
import { KpiComparisonTable, ComparisonColumn } from "@/components/KpiComparisonTable";
import { TrendChart } from "@/components/charts/TrendChart";
import { RetentionCurve } from "@/components/charts/RetentionCurve";
import { AlertsPanel } from "@/components/AlertsPanel";
import { Card } from "@/components/ui/Card";
import { DemoBanner, EmptyState, ExpectedFilesTable } from "@/components/ui/States";
import { applyFilters, distinctValues } from "@/lib/select";
import { kpisFor } from "@/lib/kpi";
import { generateAlerts } from "@/lib/alerts";
import { previousWeekKey, weekLabel, weekRange } from "@/lib/week";
import { formatDate } from "@/lib/format";

export default function HistoricalPage() {
  const { hydrated, isDemo, allRecords, filters, granularity } = useData();
  const setGranularity = useStore((s) => s.setGranularity);

  const weeks = useMemo(() => distinctValues(allRecords, "week").sort(), [allRecords]);

  // null means "follow the data": the latest week is compared with the one
  // before it until the user picks explicitly.
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);
  const latestWeek = weeks[weeks.length - 1] ?? "";
  const defaultA = weeks.includes(previousWeekKey(latestWeek))
    ? previousWeekKey(latestWeek)
    : (weeks[0] ?? "");
  const weekA = pickedA && weeks.includes(pickedA) ? pickedA : defaultA;
  const weekB = pickedB && weeks.includes(pickedB) ? pickedB : latestWeek;
  const setWeekA = setPickedA;
  const setWeekB = setPickedB;

  const recordsA = useMemo(
    () => applyFilters(allRecords, { ...filters, weeks: [weekA], dateRange: null, compareRange: null }),
    [allRecords, filters, weekA]
  );
  const recordsB = useMemo(
    () => applyFilters(allRecords, { ...filters, weeks: [weekB], dateRange: null, compareRange: null }),
    [allRecords, filters, weekB]
  );

  // Everything between the two selected weeks, for the trend charts.
  const spanRecords = useMemo(() => {
    const [from, to] = [weekA, weekB].sort();
    return applyFilters(allRecords, {
      ...filters,
      weeks: weeks.filter((w) => w >= from && w <= to),
      dateRange: null,
      compareRange: null,
    });
  }, [allRecords, filters, weekA, weekB, weeks]);

  const currency = recordsB[0]?.currency ?? recordsA[0]?.currency ?? "GBP";

  const columns: ComparisonColumn[] = useMemo(() => {
    const a = kpisFor(recordsA);
    const b = kpisFor(recordsB);
    return [
      { key: weekA, label: weekLabel(weekA), values: a, sampleDays: a.dayCount, sampleUsers: a.dauTotal },
      { key: weekB, label: weekLabel(weekB), values: b, sampleDays: b.dayCount, sampleUsers: b.dauTotal },
    ];
  }, [recordsA, recordsB, weekA, weekB]);

  const alerts = useMemo(
    () =>
      generateAlerts({
        current: recordsB,
        previous: recordsA,
        periodLabel: weekLabel(weekB),
        comparisonLabel: weekLabel(weekA),
        currency,
      }),
    [recordsA, recordsB, weekA, weekB, currency]
  );

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-white" aria-hidden="true" />;
  }

  if (allRecords.length === 0) {
    return (
      <EmptyState
        title="No history to compare yet"
        description="Import at least two weeks of exports to compare any week against any other."
        action={{ href: "/import", label: "Go to Data Import" }}
      >
        <ExpectedFilesTable />
      </EmptyState>
    );
  }

  const rangeA = weekRange(weekA);
  const rangeB = weekRange(weekB);

  return (
    <div className="space-y-4">
      {isDemo && <DemoBanner />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Historical comparison</h2>
          <p className="text-sm text-slate-500">
            Compare any two weeks and see the full KPI difference between them.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="week-a" className="block text-xs font-medium text-slate-600">
              Baseline week
            </label>
            <select
              id="week-a"
              value={weekA}
              onChange={(e) => setWeekA(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {weekLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <span aria-hidden="true" className="pb-2 text-sm text-slate-400">vs</span>
          <div>
            <label htmlFor="week-b" className="block text-xs font-medium text-slate-600">
              Comparison week
            </label>
            <select
              id="week-b"
              value={weekB}
              onChange={(e) => setWeekB(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {weekLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hist-granularity" className="block text-xs font-medium text-slate-600">
              Granularity
            </label>
            <select
              id="hist-granularity"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as typeof granularity)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title={weekLabel(weekA)}>
          <p className="text-sm text-slate-600">
            {rangeA ? `${formatDate(rangeA.start)} – ${formatDate(rangeA.end)}` : "N/A"} ·{" "}
            {recordsA.length} records
          </p>
        </Card>
        <Card title={weekLabel(weekB)}>
          <p className="text-sm text-slate-600">
            {rangeB ? `${formatDate(rangeB.start)} – ${formatDate(rangeB.end)}` : "N/A"} ·{" "}
            {recordsB.length} records
          </p>
        </Card>
      </div>

      <KpiComparisonTable
        columns={columns}
        currency={currency}
        title={`${weekLabel(weekA)} versus ${weekLabel(weekB)}`}
        question="What changed between these two weeks?"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart
          id="hist-dau"
          title="DAU trend"
          question="How has the player base moved across this span?"
          records={spanRecords}
          metrics={["dau"]}
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="hist-retention"
          title="Retention trend"
          question="Is retention drifting up or down over time?"
          records={spanRecords}
          metrics={["retentionD1", "retentionD3", "retentionD7"]}
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="hist-playtime"
          title="Playtime trend"
          question="Are players spending more time per session over time?"
          records={spanRecords}
          metrics={["playtimePerUserSeconds"]}
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="hist-revenue"
          title="Revenue and ARPDAU trend"
          question="Is revenue growing faster than the player base?"
          records={spanRecords}
          metrics={["totalRevenue"]}
          granularity={granularity}
          currency={currency}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RetentionCurve
          id="hist-retention-curve"
          records={spanRecords}
          splitBy="week"
          title="Retention curve by week"
          question="Which week produced the stickiest cohorts?"
        />
        <AlertsPanel
          alerts={alerts}
          title={`What changed in ${weekLabel(weekB)}`}
        />
      </div>
    </div>
  );
}
