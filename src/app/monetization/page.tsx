"use client";

import { useMemo } from "react";
import { useData } from "@/store/useData";
import { useStore } from "@/store/useStore";
import { KpiRow } from "@/components/KpiRow";
import { TrendChart } from "@/components/charts/TrendChart";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { Card } from "@/components/ui/Card";
import { DemoBanner, EmptyState, ExpectedFilesTable, NoResultsState } from "@/components/ui/States";
import { groupedKpis } from "@/lib/select";
import { kpisFor } from "@/lib/kpi";
import { formatCurrencyPrecise, formatNumber, formatPercent } from "@/lib/format";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/components/charts/chartUtils";

export default function MonetizationPage() {
  const { hydrated, isDemo, current, previous, allRecords, granularity } = useData();
  const clearFilters = useStore((s) => s.clearFilters);
  const setFilter = useStore((s) => s.setFilter);

  const currency = current[0]?.currency ?? "GBP";
  const kpis = useMemo(() => kpisFor(current), [current]);

  const revenueSplit = useMemo(() => {
    const parts = [
      { name: "Ad revenue", value: kpis.adRevenue },
      { name: "IAP revenue", value: kpis.iapRevenue },
    ].filter((p): p is { name: string; value: number } => p.value !== null && p.value > 0);
    return parts;
  }, [kpis]);

  const funnel = useMemo(() => {
    const totals = current.reduce(
      (acc, r) => {
        if (r.adRequests !== undefined) acc.requests = (acc.requests ?? 0) + r.adRequests;
        if (r.matchedRequests !== undefined) acc.matched = (acc.matched ?? 0) + r.matchedRequests;
        if (r.adImpressions !== undefined) acc.impressions = (acc.impressions ?? 0) + r.adImpressions;
        if (r.adClicks !== undefined) acc.clicks = (acc.clicks ?? 0) + r.adClicks;
        return acc;
      },
      {} as { requests?: number; matched?: number; impressions?: number; clicks?: number }
    );

    // Each stage is shown only when the source actually reports it.
    const stages = [
      { label: "Ad requests", value: totals.requests },
      { label: "Matched requests", value: totals.matched },
      { label: "Impressions", value: totals.impressions },
      { label: "Clicks", value: totals.clicks },
    ];

    return stages.map((stage, index) => {
      const previousStage = stages
        .slice(0, index)
        .reverse()
        .find((s) => s.value !== undefined);
      const conversion =
        stage.value !== undefined && previousStage?.value
          ? (stage.value / previousStage.value) * 100
          : null;
      return { ...stage, conversion, previousLabel: previousStage?.label };
    });
  }, [current]);

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-white" aria-hidden="true" />;
  }

  if (allRecords.length === 0) {
    return (
      <EmptyState
        title="No monetization data yet"
        description="Import an ad revenue export to unlock ARPDAU, IMPDAU, eCPM, match rate and show rate."
        action={{ href: "/import", label: "Go to Data Import" }}
      >
        <ExpectedFilesTable />
      </EmptyState>
    );
  }

  if (current.length === 0) {
    return <NoResultsState onClear={clearFilters} />;
  }

  const hasRevenue = kpis.adRevenue !== null || kpis.iapRevenue !== null;
  const maxFunnel = Math.max(...funnel.map((s) => s.value ?? 0), 1);

  return (
    <div className="space-y-4">
      {isDemo && <DemoBanner />}

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Monetization</h2>
        <p className="text-sm text-slate-500">
          Revenue per active user, ad supply and the delivery funnel behind it.
        </p>
      </div>

      {!hasRevenue && (
        <div role="note" className="rounded-md bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
          No revenue is reported in the current selection, so every revenue-derived KPI shows as N/A
          rather than zero.
        </div>
      )}

      <KpiRow
        metrics={[
          "totalRevenue",
          "arpdau",
          "arpdauAds",
          "arpdauIap",
          "impdau",
          "ecpm",
          "matchRate",
          "showRate",
        ]}
        records={current}
        compareRecords={previous}
        granularity={granularity}
        currency={currency}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart
          id="monet-revenue"
          title="Revenue trend"
          question="Is total revenue rising or falling?"
          records={current}
          compareRecords={previous}
          metrics={["totalRevenue"]}
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="monet-arpdau"
          title="ARPDAU trend"
          question="Is each active user worth more over time?"
          records={current}
          compareRecords={previous}
          metrics={["arpdau", "arpdauAds", "arpdauIap"]}
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="monet-impdau"
          title="IMPDAU trend"
          question="Are players seeing more or fewer ads each day?"
          records={current}
          compareRecords={previous}
          metrics={["impdau"]}
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="monet-ecpm"
          title="eCPM trend"
          question="Is each thousand impressions worth more?"
          records={current}
          compareRecords={previous}
          metrics={["ecpm"]}
          granularity={granularity}
          currency={currency}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Revenue split"
          question="Where does revenue actually come from?"
          tooltip="Only revenue types that the imported sources report appear here. A missing type is absent, not zero."
        >
          {revenueSplit.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No revenue is reported for the current selection.
            </p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueSplit}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {revenueSplit.map((entry, index) => (
                        <Cell key={entry.name} fill={seriesColor(index)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrencyPrecise(typeof value === "number" ? value : null, currency),
                        String(name),
                      ]}
                      contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-1 space-y-1 text-sm">
                {revenueSplit.map((entry, index) => {
                  const total = revenueSplit.reduce((sum, p) => sum + p.value, 0);
                  return (
                    <li key={entry.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ background: seriesColor(index) }}
                        />
                        {entry.name}
                      </span>
                      <span className="tabular font-medium text-slate-900">
                        {formatCurrencyPrecise(entry.value, currency)} (
                        {formatPercent((entry.value / total) * 100, 0)})
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title="Ad delivery funnel"
          question="Where is ad supply being lost?"
          tooltip="Each step is shown only when the source reports it. A stage that is not reported is omitted rather than drawn as zero."
        >
          {funnel.every((s) => s.value === undefined) ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No ad delivery data is available in the current selection.
            </p>
          ) : (
            <ol className="space-y-2">
              {funnel.map((stage) => (
                <li key={stage.label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">{stage.label}</span>
                    <span className="tabular text-slate-900">
                      {stage.value === undefined ? "Not reported" : formatNumber(Math.round(stage.value))}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-blue-600"
                      style={{ width: `${((stage.value ?? 0) / maxFunnel) * 100}%` }}
                    />
                  </div>
                  {stage.conversion !== null && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatPercent(stage.conversion)} of {stage.previousLabel}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankedBarChart
          id="monet-by-game"
          title="Revenue by game"
          question="Which title contributes most, and which monetizes best per user?"
          records={current}
          dimension="game"
          metrics={["totalRevenue", "arpdau", "ecpm", "impdau"]}
          currency={currency}
          onSelect={(key) => setFilter("games", [key])}
        />
        <RankedBarChart
          id="monet-by-country"
          title="Revenue by country"
          question="Which markets pay best per active user?"
          records={current}
          dimension="country"
          metrics={["arpdau", "totalRevenue", "ecpm"]}
          currency={currency}
          onSelect={(key) => setFilter("countries", [key])}
        />
      </div>

      <Card title="Monetization by build" question="Did a release change how the game earns?">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <caption className="sr-only">Monetization KPIs per build</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-medium">Build</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Revenue</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">ARPDAU</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">ARPDAU Ads</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">IMPDAU</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">eCPM</th>
                <th scope="col" className="py-2 text-right font-medium">Show rate</th>
              </tr>
            </thead>
            <tbody>
              {groupedKpis(current, "build").map((group) => (
                <tr key={group.key} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                    {group.key}
                  </th>
                  <td className="tabular py-2 pr-3 text-right">
                    {formatCurrencyPrecise(group.totalRevenue, currency)}
                  </td>
                  <td className="tabular py-2 pr-3 text-right">
                    {formatCurrencyPrecise(group.arpdau, currency, 4)}
                  </td>
                  <td className="tabular py-2 pr-3 text-right">
                    {formatCurrencyPrecise(group.arpdauAds, currency, 4)}
                  </td>
                  <td className="tabular py-2 pr-3 text-right">
                    {group.impdau === null ? "N/A" : group.impdau.toFixed(2)}
                  </td>
                  <td className="tabular py-2 pr-3 text-right">
                    {formatCurrencyPrecise(group.ecpm, currency)}
                  </td>
                  <td className="tabular py-2 text-right">{formatPercent(group.showRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
