"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReport, detectedGames } from "@/store/useReport";
import { Dropzone } from "@/components/import/Dropzone";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExpectedFilesTable, LoadingState } from "@/components/ui/States";
import { KpiRow } from "@/components/KpiRow";
import { TrendChart } from "@/components/charts/TrendChart";
import { RetentionCurve } from "@/components/charts/RetentionCurve";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { KpiComparisonTable, ComparisonColumn } from "@/components/KpiComparisonTable";
import { AlertsPanel } from "@/components/AlertsPanel";
import { TOKENS, seriesColor } from "@/components/charts/chartUtils";
import { generateAlerts } from "@/lib/alerts";
import { dataDateRange, distinctValues, groupedKpis } from "@/lib/select";
import { formatDate, formatFileSize, formatNumber, formatPercent } from "@/lib/format";
import { rangeLabel } from "@/lib/week";
import { exportRecordsCsv } from "@/lib/exportCsv";
import { REPORT_KIND_LABELS, SOURCE_LABELS, SourceId } from "@/lib/types";

export default function Page() {
  const phase = useReport((s) => s.phase);
  return phase === "upload" ? <UploadScreen /> : <ReportScreen />;
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

function UploadScreen() {
  const {
    files,
    isProcessing,
    game,
    addFiles,
    loadSampleFiles,
    removeFile,
    setGame,
    generate,
  } = useReport();

  const games = useMemo(() => detectedGames(files), [files]);
  const needsGameInput = files.length > 0 && games.length === 0;
  const usable = files.filter((f) => f.status !== "error");
  const canGenerate = usable.length > 0 && (games.length > 0 || game.trim() !== "");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="pt-4 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Build a KPI report from your CSV exports
        </h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
          Drop in the exports for one app — DAU, retention, playtime, ad revenue. Nothing is saved
          anywhere: the report lives in this tab and disappears when you close it.
        </p>
      </div>

      <Dropzone onFiles={addFiles} busy={isProcessing} />

      <p className="text-center text-xs text-slate-500">
        No export handy?{" "}
        <button
          type="button"
          onClick={loadSampleFiles}
          disabled={isProcessing}
          className="font-medium text-blue-700 underline hover:text-blue-800 disabled:opacity-50"
        >
          Load the bundled sample files
        </button>
      </p>

      {isProcessing && <LoadingState label="Reading files…" />}

      {files.length > 0 && (
        <Card title={`Files (${files.length})`}>
          <ul className="divide-y divide-slate-100">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {file.status === "error"
                      ? (file.error ?? "Could not be read")
                      : `${SOURCE_LABELS[file.source as SourceId] ?? file.source} · ${
                          REPORT_KIND_LABELS[file.reportKind]
                        } · ${formatNumber(file.recordCount)} rows · ${formatFileSize(file.size)}`}
                  </p>
                </div>

                {file.status === "error" ? (
                  <Badge tone="negative">Unreadable</Badge>
                ) : file.period ? (
                  <Badge tone="neutral">{rangeLabel(file.period)}</Badge>
                ) : file.plan?.some((p) => p.targetField === "date" && !p.ignored) ? (
                  <Badge tone="positive">Ready</Badge>
                ) : (
                  <Badge tone="neutral">Dates taken from the other files</Badge>
                )}

                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <label htmlFor="report-game" className="block text-xs font-medium text-slate-600">
                This report is for
              </label>
              {games.length > 0 ? (
                <select
                  id="report-game"
                  value={game}
                  onChange={(e) => setGame(e.target.value)}
                  className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  {games.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="report-game"
                  value={game}
                  onChange={(e) => setGame(e.target.value)}
                  placeholder="App name"
                  className="mt-1 w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              )}
              {needsGameInput && (
                <p className="mt-1 text-xs text-slate-500">
                  These files don&apos;t name the app, so type it once here.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!canGenerate}
              onClick={generate}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate report
            </button>
          </div>
        </Card>
      )}

      {files.length === 0 && !isProcessing && (
        <Card title="What to upload">
          <ExpectedFilesTable />
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

function ReportScreen() {
  const { records, issues, game, files, reset } = useReport();
  const [showNotes, setShowNotes] = useState(false);

  const currency = records[0]?.currency ?? "GBP";
  const range = useMemo(() => dataDateRange(records), [records]);
  const builds = useMemo(() => distinctValues(records, "build"), [records]);
  const countries = useMemo(() => distinctValues(records, "country"), [records]);
  const sources = useMemo(() => distinctValues(records, "source"), [records]);

  // Compare the later half of the covered span with the earlier half.
  const { firstHalf, secondHalf, splitLabel } = useMemo(() => {
    if (!range) return { firstHalf: [], secondHalf: records, splitLabel: null as string | null };
    const dates = Array.from(new Set(records.map((r) => r.date).filter(Boolean))).sort() as string[];
    if (dates.length < 6) return { firstHalf: [], secondHalf: records, splitLabel: null };
    const mid = dates[Math.floor(dates.length / 2)];
    return {
      firstHalf: records.filter((r) => r.date && r.date < mid),
      secondHalf: records.filter((r) => r.date && r.date >= mid),
      splitLabel: mid,
    };
  }, [records, range]);

  const alerts = useMemo(
    () =>
      generateAlerts({
        current: splitLabel ? secondHalf : records,
        previous: firstHalf,
        periodLabel: splitLabel ? "the later half of the period" : "the covered period",
        comparisonLabel: "the earlier half of the period",
        currency,
      }),
    [records, firstHalf, secondHalf, splitLabel, currency]
  );

  // Two most recent builds with users, for the A/B table.
  const buildColumns: ComparisonColumn[] = useMemo(() => {
    const grouped = groupedKpis(records, "build").filter((g) => (g.dauTotal ?? 0) > 0);
    const two = grouped.slice(-2);
    return two.map((g) => ({
      key: g.key,
      label: `Build ${g.key}`,
      values: g,
      sampleDays: g.dayCount,
      sampleUsers: g.dauTotal,
    }));
  }, [records]);

  const adoption = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    records.forEach((r) => {
      if (!r.date || !r.build || r.dau === undefined) return;
      const row = byDate.get(r.date) ?? {};
      row[r.build] = (row[r.build] ?? 0) + r.dau;
      byDate.set(r.date, row);
    });
    return {
      data: Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => {
          const total = Object.values(values).reduce((sum, v) => sum + v, 0);
          const row: Record<string, number | string> = { date };
          builds.forEach((b) => {
            row[b] = total > 0 ? ((values[b] ?? 0) / total) * 100 : 0;
          });
          return row;
        }),
    };
  }, [records, builds]);

  const warnings = issues.filter((i) => i.severity !== "info");
  const notes = issues.filter((i) => i.severity === "info");

  if (records.length === 0) {
    return (
      <div className="mx-auto max-w-xl pt-8 text-center">
        <p className="text-sm text-slate-600">
          Nothing in the uploaded files matched <strong>{game}</strong>.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{game}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {range ? rangeLabel(range) : ""} ·{" "}
            {sources.map((s) => SOURCE_LABELS[s as SourceId] ?? s).join(", ")} · {files.length}{" "}
            file(s) · {formatNumber(records.length)} records
            {builds.length > 0 && ` · builds ${builds.join(", ")}`}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => exportRecordsCsv(records, `${game.replace(/\W+/g, "-")}-kpis.csv`)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Print
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            New report
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div
          role="note"
          className="rounded-md bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20"
        >
          {warnings.length} data warning(s):{" "}
          {warnings
            .slice(0, 2)
            .map((w) => w.description)
            .join(" ")}{" "}
          {warnings.length > 2 && `+${warnings.length - 2} more below.`}
        </div>
      )}

      <h3 className="pt-1 text-sm font-semibold text-slate-900">Headline KPIs</h3>
      <KpiRow
        metrics={["dau", "playtimePerUserSeconds", "sessionsPerUser", "retentionD1"]}
        records={records}
        compareRecords={firstHalf.length > 0 ? firstHalf : []}
        granularity="daily"
        currency={currency}
      />
      <KpiRow
        metrics={["totalRevenue", "arpdau", "impdau", "ecpm"]}
        records={records}
        compareRecords={firstHalf.length > 0 ? firstHalf : []}
        granularity="daily"
        currency={currency}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          id="report-dau"
          title="DAU by build"
          question="Which builds carry the player base?"
          records={records}
          metrics={["dau"]}
          splitBy="build"
          granularity="daily"
          currency={currency}
        />
        <RetentionCurve
          id="report-retention"
          records={records}
          title="Retention curve (D1–D7)"
          question="How quickly do new players stop coming back?"
        />
        <TrendChart
          id="report-playtime"
          title="Playtime per user"
          question="Are sessions getting longer or shorter?"
          records={records}
          metrics={["playtimePerUserSeconds"]}
          granularity="daily"
          currency={currency}
        />
        <TrendChart
          id="report-revenue"
          title="Revenue"
          question="Is daily revenue rising or falling?"
          records={records}
          metrics={["totalRevenue"]}
          granularity="daily"
          currency={currency}
        />
      </div>

      {countries.length >= 2 && (
        <RankedBarChart
          id="report-countries"
          title="Country comparison"
          question="Which markets keep and monetize players best?"
          records={records}
          dimension="country"
          metrics={["retentionD1", "dau", "arpdau", "totalRevenue"]}
          currency={currency}
        />
      )}

      {buildColumns.length === 2 && (
        <KpiComparisonTable
          columns={buildColumns}
          currency={currency}
          title={`${buildColumns[0].label} vs ${buildColumns[1].label}`}
          question="Did the newer build improve or damage the KPIs?"
        />
      )}

      {adoption.data.length > 1 && builds.length > 1 && (
        <Card
          title="Build rollout"
          question="What share of players is on each build?"
          tooltip="Share of daily active users by build. A large share left on old builds limits what a new release can move."
        >
          <div className="h-64">
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
                {builds.map((build, index) => (
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
            {builds.map((build, index) => (
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
        </Card>
      )}

      <AlertsPanel alerts={alerts} title="What stands out" />

      {(warnings.length > 0 || notes.length > 0) && (
        <Card
          title={`Data notes (${issues.length})`}
          actions={
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              aria-expanded={showNotes}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {showNotes ? "Hide" : "Show"}
            </button>
          }
        >
          {showNotes ? (
            <ul className="space-y-1.5">
              {issues.map((issue) => (
                <li
                  key={issue.id}
                  className={`rounded-md px-3 py-2 text-xs ${
                    issue.severity === "error"
                      ? "bg-red-50 text-red-800"
                      : issue.severity === "warning"
                        ? "bg-amber-50 text-amber-900"
                        : "bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="font-semibold">{issue.category}:</span> {issue.description}{" "}
                  <span className="opacity-75">{issue.resolution}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              {warnings.length} warning(s) and {notes.length} note(s) about how the numbers were
              put together.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
