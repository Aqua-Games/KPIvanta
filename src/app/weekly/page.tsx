"use client";

import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { useStore } from "@/store/useStore";
import { KpiRow } from "@/components/KpiRow";
import { TrendChart } from "@/components/charts/TrendChart";
import { RetentionCurve } from "@/components/charts/RetentionCurve";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { KpiComparisonTable, ComparisonColumn } from "@/components/KpiComparisonTable";
import { AlertsPanel } from "@/components/AlertsPanel";
import { Card } from "@/components/ui/Card";
import { DemoBanner, EmptyState, ExpectedFilesTable } from "@/components/ui/States";
import { applyFilters, distinctValues } from "@/lib/select";
import { kpisFor } from "@/lib/kpi";
import { generateAlerts } from "@/lib/alerts";
import { performanceScore, scoreTone } from "@/lib/score";
import { previousWeekKey, weekLabel, weekLabelWithRange, weekRange } from "@/lib/week";
import { formatDate, formatNumber } from "@/lib/format";
import { SOURCE_LABELS, SourceId } from "@/lib/types";
import { exportRecordsCsv } from "@/lib/exportCsv";

export default function WeeklyReportPage() {
  const { hydrated, isDemo, allRecords, filters } = useData();
  const granularity = useStore((s) => s.granularity);
  const setGranularity = useStore((s) => s.setGranularity);

  const weeks = useMemo(
    () => distinctValues(allRecords, "week").sort().reverse(),
    [allRecords]
  );
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const week = selectedWeek || weeks[0] || "";
  const comparisonWeek = previousWeekKey(week);

  // The week selector overrides the global date range for this page only.
  const weekFilters = useMemo(
    () => ({ ...filters, weeks: [week], dateRange: null, compareRange: null }),
    [filters, week]
  );
  const compareFilters = useMemo(
    () => ({ ...filters, weeks: [comparisonWeek], dateRange: null, compareRange: null }),
    [filters, comparisonWeek]
  );

  const current = useMemo(() => applyFilters(allRecords, weekFilters), [allRecords, weekFilters]);
  const previous = useMemo(
    () => applyFilters(allRecords, compareFilters),
    [allRecords, compareFilters]
  );

  const currency = current[0]?.currency ?? "GBP";
  const range = weekRange(week);

  const score = useMemo(
    () => performanceScore(kpisFor(current), kpisFor(previous)),
    [current, previous]
  );

  const alerts = useMemo(
    () =>
      generateAlerts({
        current,
        previous,
        periodLabel: weekLabel(week),
        comparisonLabel: weekLabel(comparisonWeek),
        currency,
      }),
    [current, previous, week, comparisonWeek, currency]
  );

  const columns: ComparisonColumn[] = useMemo(() => {
    const currentKpis = kpisFor(current);
    const previousKpis = kpisFor(previous);
    return [
      {
        key: comparisonWeek,
        label: weekLabel(comparisonWeek),
        values: previousKpis,
        sampleDays: previousKpis.dayCount,
        sampleUsers: previousKpis.dauTotal,
      },
      {
        key: week,
        label: weekLabel(week),
        values: currentKpis,
        sampleDays: currentKpis.dayCount,
        sampleUsers: currentKpis.dauTotal,
      },
    ];
  }, [current, previous, week, comparisonWeek]);

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-white" aria-hidden="true" />;
  }

  if (allRecords.length === 0) {
    return (
      <EmptyState
        title="No weekly reports yet"
        description="Import at least one week of exports to generate a weekly performance report."
        action={{ href: "/import", label: "Go to Data Import" }}
      >
        <ExpectedFilesTable />
      </EmptyState>
    );
  }

  const games = distinctValues(current, "game");
  const platforms = distinctValues(current, "platform");
  const countries = distinctValues(current, "country");
  const builds = distinctValues(current, "build");
  const sources = distinctValues(current, "source");

  return (
    <div className="space-y-4">
      {isDemo && <DemoBanner />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Weekly performance report</h2>
          <p className="text-sm text-slate-500">
            {range ? `${formatDate(range.start)} – ${formatDate(range.end)}` : "Select a week"} ·
            compared with {weekLabel(comparisonWeek)}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="week-select" className="block text-xs font-medium text-slate-600">
              Week
            </label>
            <select
              id="week-select"
              value={week}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {weekLabelWithRange(w)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="granularity" className="block text-xs font-medium text-slate-600">
              Trend granularity
            </label>
            <select
              id="granularity"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as typeof granularity)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => exportRecordsCsv(current, `weekly-report-${week}.csv`)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export week
          </button>
        </div>
      </div>

      {current.length === 0 ? (
        <Card title="No data for this week">
          <p className="py-6 text-center text-sm text-slate-500">
            {weekLabel(week)} has no records under the current filters.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <Card title="General information" question="What does this report cover?">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Info label="Week" value={weekLabel(week)} />
                <Info
                  label="Dates"
                  value={range ? `${formatDate(range.start)} – ${formatDate(range.end)}` : "N/A"}
                />
                <Info label="Games" value={games.join(", ") || "N/A"} />
                <Info label="Platforms" value={platforms.join(", ") || "Not reported"} />
                <Info label="Countries" value={countries.join(", ") || "Not reported"} />
                <Info label="Builds" value={builds.join(", ") || "Not reported"} />
                <Info
                  label="Sources"
                  value={
                    sources.map((s) => SOURCE_LABELS[s as SourceId] ?? s).join(", ") || "N/A"
                  }
                />
                <Info label="Records" value={formatNumber(current.length)} />
              </dl>
            </Card>

            <Card
              title="Weekly performance score"
              question="Better or worse than last week?"
              tooltip="Weighted composite of retention, engagement, monetization and stability KPIs against the previous week. 50 means level."
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={`tabular text-4xl font-semibold ${
                    scoreTone(score.value) === "positive"
                      ? "text-emerald-600"
                      : scoreTone(score.value) === "negative"
                        ? "text-red-600"
                        : "text-slate-900"
                  }`}
                >
                  {score.value ?? "N/A"}
                </span>
                <span className="text-sm text-slate-500">/ 100</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{score.interpretation}</p>
              <ul className="mt-3 space-y-0.5 text-xs text-slate-500">
                {score.components
                  .filter((c) => c.contribution !== null)
                  .sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0))
                  .slice(0, 3)
                  .map((c) => (
                    <li key={c.id}>
                      {c.label}: {(c.contribution ?? 0) > 0 ? "+" : ""}
                      {(c.contribution ?? 0).toFixed(1)} points of influence
                    </li>
                  ))}
              </ul>
            </Card>

            <AlertsPanel alerts={alerts} title="Weekly summary" limit={4} />
          </div>

          <h3 className="pt-1 text-sm font-semibold text-slate-900">KPIs for {weekLabel(week)}</h3>
          <KpiRow
            metrics={[
              "dau",
              "playtimePerUserSeconds",
              "retentionD1",
              "retentionD3",
              "retentionD7",
              "impdau",
              "arpdau",
              "arpdauAds",
              "arpdauIap",
              "anrRate",
              "crashRate",
              "sessionsPerUser",
            ]}
            records={current}
            compareRecords={previous}
            granularity="daily"
            currency={currency}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <TrendChart
              id="weekly-dau"
              title="DAU trend"
              question="How did the player base move during the week?"
              records={current}
              compareRecords={previous}
              metrics={["dau"]}
              granularity="daily"
              currency={currency}
            />
            <TrendChart
              id="weekly-playtime"
              title="Playtime trend"
              question="Are sessions getting longer or shorter?"
              records={current}
              compareRecords={previous}
              metrics={["playtimePerUserSeconds"]}
              granularity="daily"
              currency={currency}
            />
            <TrendChart
              id="weekly-retention"
              title="Retention trend"
              question="Is each new cohort sticking better than the last?"
              records={current}
              metrics={["retentionD1", "retentionD3", "retentionD7"]}
              granularity="daily"
              currency={currency}
            />
            <TrendChart
              id="weekly-revenue"
              title="Revenue and IMPDAU trend"
              question="Is ad supply keeping up with revenue?"
              records={current}
              compareRecords={previous}
              metrics={["totalRevenue"]}
              granularity="daily"
              currency={currency}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <RetentionCurve id="weekly-retention-curve" records={current} splitBy="build" />
            <RankedBarChart
              id="weekly-build-ranking"
              title="Build comparison this week"
              question="Which build performs best on the selected KPI?"
              records={current}
              dimension="build"
              metrics={["retentionD1", "dau", "playtimePerUserSeconds", "arpdau"]}
              currency={currency}
            />
          </div>

          <KpiComparisonTable
            columns={columns}
            currency={currency}
            title="This week versus last week"
            question="Which KPIs moved, and by how much?"
          />
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
