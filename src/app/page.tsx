"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/store/useData";
import { usePageTitle } from "@/components/usePageTitle";
import { useStore } from "@/store/useStore";
import { KpiRow } from "@/components/KpiRow";
import { TrendChart } from "@/components/charts/TrendChart";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { AlertsPanel } from "@/components/AlertsPanel";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ExpectedFilesTable, NoResultsState } from "@/components/ui/States";
import { generateAlerts } from "@/lib/alerts";
import { kpisFor } from "@/lib/kpi";
import { groupedKpis } from "@/lib/select";
import { performanceScore, scoreTone } from "@/lib/score";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { weekLabel } from "@/lib/week";
import { SOURCE_LABELS, SourceId } from "@/lib/types";

export default function HomePage() {
  usePageTitle("Dashboard Home");
  const { hydrated, isDemo, current, previous, allRecords, filters, granularity, files } = useData();
  const clearFilters = useStore((s) => s.clearFilters);
  const setFilter = useStore((s) => s.setFilter);

  const currency = current[0]?.currency ?? "GBP";

  const alerts = useMemo(
    () =>
      generateAlerts({
        current,
        previous,
        periodLabel: filters.dateRange
          ? `${formatDate(filters.dateRange.start)} – ${formatDate(filters.dateRange.end)}`
          : "the selected period",
        comparisonLabel: filters.compareRange
          ? `${formatDate(filters.compareRange.start)} – ${formatDate(filters.compareRange.end)}`
          : "the comparison period",
        currency,
      }),
    [current, previous, filters, currency]
  );

  const score = useMemo(
    () => performanceScore(kpisFor(current), kpisFor(previous)),
    [current, previous]
  );

  const gameRanking = useMemo(() => groupedKpis(current, "game"), [current]);
  const games = useMemo(
    () => new Set(allRecords.map((r) => r.game).filter(Boolean)).size,
    [allRecords]
  );
  const weeks = useMemo(
    () => new Set(allRecords.map((r) => r.week).filter(Boolean)),
    [allRecords]
  );
  const latestUpload = useMemo(
    () => [...files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0],
    [files]
  );

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-white" aria-hidden="true" />;
  }

  if (allRecords.length === 0) {
    return (
      <EmptyState
        title="No data has been imported yet"
        description="Upload your weekly analytics exports to build the historical database. Each file below unlocks a different part of the dashboard."
        action={{ href: "/import", label: "Go to Data Import" }}
      >
        <ExpectedFilesTable />
      </EmptyState>
    );
  }

  if (current.length === 0) {
    return <NoResultsState onClear={clearFilters} />;
  }

  const ranked = gameRanking.filter((g) => g.arpdau !== null);
  const best = [...ranked].sort((a, b) => (b.arpdau ?? 0) - (a.arpdau ?? 0))[0];
  const worst = [...ranked].sort((a, b) => (a.arpdau ?? 0) - (b.arpdau ?? 0))[0];

  return (
    <div className="space-y-4">
      <section aria-label="Database summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Games tracked"
          value={formatNumber(games)}
          hint="Distinct titles in the database"
        />
        <SummaryCard
          label="Weeks of history"
          value={formatNumber(weeks.size)}
          hint={
            weeks.size > 0
              ? `Latest: ${weekLabel(Array.from(weeks).sort().pop() ?? "")}`
              : "No weeks recorded"
          }
        />
        <SummaryCard
          label="Records stored"
          value={formatNumber(allRecords.length)}
          hint={isDemo ? "Sample dataset — import files to replace" : `${files.length} file(s) imported`}
        />
        <SummaryCard
          label="Latest upload"
          value={latestUpload ? latestUpload.name : "None"}
          hint={latestUpload ? formatDateTime(latestUpload.uploadedAt) : "Import a file to begin"}
        />
      </section>

      <section aria-label="Performance summary" className="grid gap-3 lg:grid-cols-3">
        <Card
          title="Performance score"
          question="Is this period better or worse than the comparison period overall?"
          tooltip="A weighted composite of retention, engagement, monetization and stability KPIs. 50 means level with the comparison period. KPIs without comparable data are excluded, and coverage shows how much of the KPI set was usable."
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
          <p className="mt-1 text-xs text-slate-500">
            Coverage: {score.coverage.toFixed(0)}% of the scored KPI set had data in both periods.
          </p>
        </Card>

        <Card title="Best performing game" question="Which title earns most per active user?">
          {best ? (
            <>
              <p className="text-base font-semibold text-slate-900">{best.key}</p>
              <dl className="mt-2 space-y-1 text-sm text-slate-600">
                <Stat label="ARPDAU" value={best.arpdau} format="currency" currency={currency} />
                <Stat label="D1 retention" value={best.retentionD1} format="percent" />
                <Stat label="Average DAU" value={best.dau} format="number" />
              </dl>
              <button
                type="button"
                onClick={() => setFilter("games", [best.key])}
                className="mt-3 text-xs font-medium text-blue-700 hover:underline"
              >
                Filter the dashboard to {best.key} →
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              No game reports both revenue and DAU, so ARPDAU cannot be ranked.
            </p>
          )}
        </Card>

        <Card title="Needs attention" question="Which title earns least per active user?">
          {worst && best && worst.key !== best.key ? (
            <>
              <p className="text-base font-semibold text-slate-900">{worst.key}</p>
              <dl className="mt-2 space-y-1 text-sm text-slate-600">
                <Stat label="ARPDAU" value={worst.arpdau} format="currency" currency={currency} />
                <Stat label="D1 retention" value={worst.retentionD1} format="percent" />
                <Stat label="Average DAU" value={worst.dau} format="number" />
              </dl>
              <button
                type="button"
                onClick={() => setFilter("games", [worst.key])}
                className="mt-3 text-xs font-medium text-blue-700 hover:underline"
              >
                Filter the dashboard to {worst.key} →
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              At least two games reporting revenue and DAU are needed to rank a weakest title.
            </p>
          )}
        </Card>
      </section>

      <Card
        title="Games at a glance"
        question="What is each title, where does it run, and how is it doing?"
        tooltip="One row per game in the selected period. KPIs are aggregate-correct: retention weighted by cohort, per-user figures divided from totals. Click a game to filter the whole dashboard to it."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <caption className="sr-only">Key information and KPIs for each game</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-medium">Game</th>
                <th scope="col" className="py-2 pr-3 font-medium">Platform</th>
                <th scope="col" className="py-2 pr-3 font-medium">Builds</th>
                <th scope="col" className="py-2 pr-3 font-medium">Countries</th>
                <th scope="col" className="py-2 pr-3 font-medium">Data sources</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Days of data</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Avg DAU</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">D1</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Playtime/user</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Revenue</th>
                <th scope="col" className="py-2 text-right font-medium">ARPDAU</th>
              </tr>
            </thead>
            <tbody>
              {gameRanking.map((game) => {
                const platforms = Array.from(
                  new Set(game.records.map((r) => r.platform).filter(Boolean))
                );
                const builds = Array.from(
                  new Set(game.records.map((r) => r.build).filter(Boolean))
                ).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
                const countries = Array.from(
                  new Set(game.records.map((r) => r.country).filter(Boolean))
                );
                const gameSources = Array.from(
                  new Set(game.records.flatMap((r) => r.sources ?? [r.source]))
                );
                return (
                  <tr
                    key={game.key}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                  >
                    <th scope="row" className="py-2 pr-3 text-left">
                      <button
                        type="button"
                        onClick={() => setFilter("games", [game.key])}
                        className="font-medium text-blue-700 hover:underline"
                        title={`Filter the dashboard to ${game.key}`}
                      >
                        {game.key}
                      </button>
                    </th>
                    <td className="py-2 pr-3 text-slate-600">
                      {platforms.join(", ") || "Not reported"}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {builds.length > 0 ? (
                        <span title={builds.join(", ")}>
                          {builds.length} ({builds.slice(-2).join(", ")}
                          {builds.length > 2 ? " latest" : ""})
                        </span>
                      ) : (
                        "Not reported"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {countries.length > 0 ? countries.join(", ") : "All countries"}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {gameSources.map((s) => SOURCE_LABELS[s as SourceId] ?? s).join(", ")}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-slate-600">
                      {formatNumber(game.dayCount)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-slate-900">
                      {game.dau === null ? "N/A" : formatNumber(Math.round(game.dau))}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-slate-900">
                      {game.retentionD1 === null ? "N/A" : `${game.retentionD1.toFixed(1)}%`}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-slate-900">
                      {game.playtimePerUserSeconds === null
                        ? "N/A"
                        : `${Math.round(game.playtimePerUserSeconds / 60)}m`}
                    </td>
                    <td className="tabular py-2 pr-3 text-right text-slate-900">
                      {game.totalRevenue === null
                        ? "N/A"
                        : new Intl.NumberFormat("en-GB", {
                            style: "currency",
                            currency,
                            maximumFractionDigits: 0,
                          }).format(game.totalRevenue)}
                    </td>
                    <td className="tabular py-2 text-right text-slate-900">
                      {game.arpdau === null
                        ? "N/A"
                        : new Intl.NumberFormat("en-GB", {
                            style: "currency",
                            currency,
                            maximumFractionDigits: 4,
                          }).format(game.arpdau)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="pt-1 text-sm font-semibold text-slate-900">Headline KPIs</h2>
      <KpiRow
        metrics={[
          "dau",
          "retentionD1",
          "retentionD7",
          "playtimePerUserSeconds",
          "arpdau",
          "impdau",
          "sessionsPerUser",
          "crashRate",
        ]}
        records={current}
        compareRecords={previous}
        granularity={granularity}
        currency={currency}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart
          id="dau-trend"
          title="DAU trend"
          question="Is the active player base growing?"
          records={current}
          compareRecords={previous}
          metrics={["dau"]}
          granularity={granularity}
          currency={currency}
        />
        <TrendChart
          id="revenue-trend"
          title="Revenue trend"
          question="Is revenue tracking the player base?"
          records={current}
          compareRecords={previous}
          metrics={["totalRevenue"]}
          granularity={granularity}
          currency={currency}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankedBarChart
          id="game-ranking"
          title="Game comparison"
          question="Which titles lead on the selected KPI?"
          records={current}
          dimension="game"
          metrics={["arpdau", "dau", "retentionD1", "impdau"]}
          currency={currency}
          onSelect={(key) => setFilter("games", [key])}
        />
        <AlertsPanel alerts={alerts} limit={6} />
      </div>

      <Card title="Recent uploads" question="What is in the historical database?">
        {files.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            No files imported yet — the dashboard is showing the demo dataset.{" "}
            <Link href="/import" className="font-medium text-blue-700 hover:underline">
              Import a file
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <caption className="sr-only">Files imported into the historical database</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-medium">File</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Game</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Records</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Uploaded</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...files]
                  .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
                  .slice(0, 6)
                  .map((file) => (
                    <tr key={file.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                        {file.name}
                      </th>
                      <td className="py-2 pr-3 text-slate-600">
                        {SOURCE_LABELS[file.source as SourceId] ?? file.source}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{file.game ?? "—"}</td>
                      <td className="tabular py-2 pr-3 text-right text-slate-600">
                        {formatNumber(file.importedRecordCount)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{formatDateTime(file.uploadedAt)}</td>
                      <td className="py-2">
                        <Badge
                          tone={
                            file.status === "imported"
                              ? "positive"
                              : file.status === "error" || file.status === "duplicate"
                                ? "negative"
                                : file.status === "partial"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {file.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold text-slate-900" title={value}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  format,
  currency,
}: {
  label: string;
  value: number | null;
  format: "currency" | "percent" | "number";
  currency?: string;
}) {
  const display =
    value === null
      ? "N/A"
      : format === "currency"
        ? new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: currency ?? "GBP",
            maximumFractionDigits: 4,
          }).format(value)
        : format === "percent"
          ? `${value.toFixed(1)}%`
          : formatNumber(Math.round(value));

  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="tabular font-medium text-slate-900">{display}</dd>
    </div>
  );
}
