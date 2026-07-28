"use client";

import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { usePageTitle } from "@/components/usePageTitle";
import { KpiComparisonTable, ComparisonColumn } from "@/components/KpiComparisonTable";
import { TrendChart } from "@/components/charts/TrendChart";
import { RetentionCurve } from "@/components/charts/RetentionCurve";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ExpectedFilesTable } from "@/components/ui/States";
import { distinctValues, groupedKpis } from "@/lib/select";
import { kpisFor } from "@/lib/kpi";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TOKENS, seriesColor } from "@/components/charts/chartUtils";

export default function BuildComparisonPage() {
  usePageTitle("Build Comparison");
  const { hydrated, current, allRecords, granularity } = useData();
  const currency = current[0]?.currency ?? "GBP";

  const builds = useMemo(() => distinctValues(current, "build"), [current]);

  // null means "follow the data": the two most recent builds are compared until
  // the user picks explicitly, and a stale pick falls back automatically.
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);
  const buildA =
    pickedA && builds.includes(pickedA) ? pickedA : (builds[builds.length - 2] ?? builds[0] ?? "");
  const buildB = pickedB && builds.includes(pickedB) ? pickedB : (builds[builds.length - 1] ?? "");
  const setBuildA = setPickedA;
  const setBuildB = setPickedB;

  const recordsA = useMemo(() => current.filter((r) => r.build === buildA), [current, buildA]);
  const recordsB = useMemo(() => current.filter((r) => r.build === buildB), [current, buildB]);
  const pairRecords = useMemo(
    () => current.filter((r) => r.build === buildA || r.build === buildB),
    [current, buildA, buildB]
  );

  const columns: ComparisonColumn[] = useMemo(() => {
    const a = kpisFor(recordsA);
    const b = kpisFor(recordsB);
    return [
      { key: buildA, label: `Build ${buildA}`, values: a, sampleDays: a.dayCount, sampleUsers: a.dauTotal },
      { key: buildB, label: `Build ${buildB}`, values: b, sampleDays: b.dayCount, sampleUsers: b.dauTotal },
    ];
  }, [recordsA, recordsB, buildA, buildB]);

  // Share of daily active users on each build — the adoption/rollout view.
  const adoption = useMemo(() => {
    const allBuilds = distinctValues(current, "build");
    const byDate = new Map<string, Record<string, number>>();
    current.forEach((record) => {
      if (!record.date || !record.build || record.dau === undefined) return;
      const row = byDate.get(record.date) ?? {};
      row[record.build] = (row[record.build] ?? 0) + record.dau;
      byDate.set(record.date, row);
    });

    return {
      builds: allBuilds,
      data: Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => {
          const total = Object.values(values).reduce((sum, v) => sum + v, 0);
          const row: Record<string, number | string> = { date };
          allBuilds.forEach((build) => {
            row[build] = total > 0 ? ((values[build] ?? 0) / total) * 100 : 0;
          });
          return row;
        }),
    };
  }, [current]);

  const buildSummary = useMemo(() => groupedKpis(current, "build"), [current]);

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-white" aria-hidden="true" />;
  }

  if (allRecords.length === 0) {
    return (
      <EmptyState
        title="No builds to compare"
        description="Import a DAU or playtime export with one column per build to unlock build comparison."
        action={{ href: "/import", label: "Go to Data Import" }}
      >
        <ExpectedFilesTable />
      </EmptyState>
    );
  }

  if (builds.length < 2) {
    return (
      <div className="space-y-4">
          <EmptyState
          title="At least two builds are needed"
          description={`The current selection contains ${builds.length} build${builds.length === 1 ? "" : "s"}. Widen the date range or clear the build filter to compare two versions.`}
        />
      </div>
    );
  }

  const firstSeenA = recordsA.map((r) => r.date).filter(Boolean).sort()[0];
  const firstSeenB = recordsB.map((r) => r.date).filter(Boolean).sort()[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Build Comparison (A/B)</h2>
          <p className="text-sm text-slate-500">
            Improvements and regressions between any two builds, on like-for-like KPIs.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="build-a" className="block text-xs font-medium text-slate-600">
              Build A (baseline)
            </label>
            <select
              id="build-a"
              value={buildA}
              onChange={(e) => setBuildA(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {builds.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <span aria-hidden="true" className="pb-2 text-sm text-slate-400">vs</span>
          <div>
            <label htmlFor="build-b" className="block text-xs font-medium text-slate-600">
              Build B
            </label>
            <select
              id="build-b"
              value={buildB}
              onChange={(e) => setBuildB(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {builds.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {buildA === buildB && (
        <div role="note" className="rounded-md bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
          Build A and Build B are the same version. Pick two different builds to see a comparison.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {[
          { label: "Build A", build: buildA, records: recordsA, firstSeen: firstSeenA },
          { label: "Build B", build: buildB, records: recordsB, firstSeen: firstSeenB },
        ].map((side) => {
          const kpis = kpisFor(side.records);
          return (
            <Card key={side.label} title={`${side.label}: ${side.build}`}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <Metric label="First seen" value={side.firstSeen ? formatDate(side.firstSeen) : "N/A"} />
                <Metric label="Days of data" value={formatNumber(kpis.dayCount)} />
                <Metric
                  label="Average DAU"
                  value={kpis.dau === null ? "N/A" : formatNumber(Math.round(kpis.dau))}
                />
                <Metric label="D1 retention" value={formatPercent(kpis.retentionD1)} />
                <Metric label="D7 retention" value={formatPercent(kpis.retentionD7)} />
                <Metric label="Crash rate" value={formatPercent(kpis.crashRate, 2)} />
              </dl>
              {kpis.dayCount < 3 && (
                <p className="mt-2">
                  <Badge tone="warning">Fewer than 3 days of data</Badge>
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <KpiComparisonTable
        columns={columns}
        currency={currency}
        title={`Build ${buildA} versus build ${buildB}`}
        question="Which KPIs improved and which regressed?"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart
          id="build-dau"
          title="DAU by build"
          question="How is the player base distributed between builds?"
          records={pairRecords}
          metrics={["dau"]}
          splitBy="build"
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="build-retention"
          title="D1 retention by build"
          question="Does the newer build hold new players better?"
          records={pairRecords}
          metrics={["retentionD1"]}
          splitBy="build"
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="build-arpdau"
          title="ARPDAU by build"
          question="Does the newer build monetize better per active user?"
          records={pairRecords}
          metrics={["arpdau"]}
          splitBy="build"
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="build-crash"
          title="Crash rate by build"
          question="Did stability regress after the release?"
          records={pairRecords}
          metrics={["crashRate"]}
          splitBy="build"
          granularity={granularity}
          currency={currency}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RetentionCurve
          id="build-retention-curve"
          records={pairRecords}
          splitBy="build"
          title="Retention curve by build"
          question="Where in the first week does each build lose players?"
        />
        <RankedBarChart
          id="build-ranking"
          title="All builds ranked"
          question="How does every build compare on the selected KPI?"
          records={current}
          dimension="build"
          metrics={["retentionD1", "retentionD3", "retentionD7", "arpdau", "playtimePerUserSeconds", "crashRate"]}
          currency={currency}
        />
      </div>

      <Card
        id="build-rollout"
        title="Build rollout"
        question="What share of active users is on each build over time?"
        tooltip="Share of daily active users by build. Slow adoption or a large share left on old builds limits how much a new release can move the overall KPIs."
      >
        {adoption.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            DAU by build is required to chart rollout, and it is not available in the current selection.
          </p>
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={adoption.data} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={TOKENS.grid} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatPercent(typeof value === "number" ? value : null),
                      `Build ${String(name)}`,
                    ]}
                    labelFormatter={(label) => formatDate(String(label))}
                    contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
                  />
                  {adoption.builds.map((build, index) => (
                    <Area
                      key={build}
                      type="monotone"
                      dataKey={build}
                      stackId="rollout"
                      stroke={seriesColor(index)}
                      fill={seriesColor(index)}
                      fillOpacity={0.75}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {adoption.builds.map((build, index) => (
                <span key={build} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ background: seriesColor(index) }}
                  />
                  Build {build}
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card
        title="All builds at a glance"
        question="Is any build carrying users without carrying its weight?"
        tooltip="Builds are compared on normalised, per-user KPIs so a build with a small user base is not penalised for low totals."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Per-build KPI summary</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-medium">Build</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Avg DAU</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Share of DAU</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">D1</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">D7</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Playtime/user</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">ARPDAU</th>
                <th scope="col" className="py-2 text-right font-medium">Crash rate</th>
              </tr>
            </thead>
            <tbody>
              {buildSummary.map((group) => {
                const totalDau = buildSummary.reduce((sum, g) => sum + (g.dauTotal ?? 0), 0);
                const share = totalDau > 0 ? ((group.dauTotal ?? 0) / totalDau) * 100 : null;
                return (
                  <tr key={group.key} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                      {group.key}
                    </th>
                    <td className="tabular py-2 pr-3 text-right">
                      {group.dau === null ? "N/A" : formatNumber(Math.round(group.dau))}
                    </td>
                    <td className="tabular py-2 pr-3 text-right">{formatPercent(share)}</td>
                    <td className="tabular py-2 pr-3 text-right">{formatPercent(group.retentionD1)}</td>
                    <td className="tabular py-2 pr-3 text-right">{formatPercent(group.retentionD7)}</td>
                    <td className="tabular py-2 pr-3 text-right">
                      {group.playtimePerUserSeconds === null
                        ? "N/A"
                        : `${Math.round(group.playtimePerUserSeconds / 60)}m`}
                    </td>
                    <td className="tabular py-2 pr-3 text-right">
                      {group.arpdau === null
                        ? "N/A"
                        : new Intl.NumberFormat("en-GB", {
                            style: "currency",
                            currency,
                            maximumFractionDigits: 4,
                          }).format(group.arpdau)}
                    </td>
                    <td className="tabular py-2 text-right">{formatPercent(group.crashRate, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="tabular font-medium text-slate-800">{value}</dd>
    </div>
  );
}
