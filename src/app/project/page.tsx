"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWorkspace, applyWeeklySpend } from "@/store/useWorkspace";
import { Dropzone } from "@/components/import/Dropzone";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ErrorState, ExpectedFilesTable, LoadingState } from "@/components/ui/States";
import { SixBoxes } from "@/components/SixBoxes";
import { FirebaseSync } from "@/components/FirebaseSync";
import { TrendChart } from "@/components/charts/TrendChart";
import { RetentionCurve } from "@/components/charts/RetentionCurve";
import { RankedBarChart } from "@/components/charts/RankedBarChart";
import { KpiComparisonTable, ComparisonColumn } from "@/components/KpiComparisonTable";
import { AlertsPanel } from "@/components/AlertsPanel";
import { kpisFor } from "@/lib/kpi";
import { generateAlerts } from "@/lib/alerts";
import { dataDateRange, distinctValues, groupedKpis } from "@/lib/select";
import { formatCurrencyPrecise, formatFileSize, formatNumber } from "@/lib/format";
import { rangeLabel, weekLabel, weekLabelWithRange, weekRange, WeekStart } from "@/lib/week";
import { exportRecordsCsv } from "@/lib/exportCsv";
import { REPORT_KIND_LABELS, SOURCE_LABELS, SourceId } from "@/lib/types";

/**
 * The Firebase Analytics sync is finished but parked until the GA4 service
 * account is set up. Flip this to true to bring the panel back.
 */
const GA4_SYNC_ENABLED = false;

type Tab = "overview" | "weekly" | "builds";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "weekly", label: "Weekly Comparison" },
  { id: "builds", label: "Build Comparison" },
];

export default function ProjectPageRoute() {
  return (
    <Suspense fallback={<LoadingState label="Loading project…" />}>
      <ProjectPage />
    </Suspense>
  );
}

function ProjectPage() {
  const projectId = useSearchParams().get("id") ?? "";
  const {
    project,
    loading,
    error,
    records: rawRecords,
    files,
    issues,
    weeklySpend,
    staged,
    isProcessing,
    saving,
    load,
    addFiles,
    loadSampleFiles,
    removeStaged,
    processStaged,
    setWeeklySpend,
    setProjectWeekStart,
    clearData,
  } = useWorkspace();

  const [tab, setTab] = useState<Tab>("overview");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    load(projectId);
  }, [projectId, load]);

  // Manual spend joins the record set as per-day rows, so it aggregates like
  // any other metric under whatever slice a tab looks at.
  const records = useMemo(
    () => applyWeeklySpend(rawRecords, weeklySpend),
    [rawRecords, weeklySpend]
  );

  const currency = project?.currency ?? "GBP";
  const range = useMemo(() => dataDateRange(records), [records]);
  const weeks = useMemo(() => distinctValues(records, "week").sort(), [records]);
  const builds = useMemo(() => distinctValues(records, "build"), [records]);
  const countries = useMemo(() => distinctValues(records, "country"), [records]);

  if (loading) return <LoadingState label="Loading project…" />;
  if (error) return <ErrorState title="Could not load this project" description={error} />;
  if (!project) return <LoadingState label="Loading project…" />;

  const hasData = rawRecords.length > 0;
  const uploadOpen = showUpload || !hasData;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pt-2">
        <div>
          <Link
            href={`/company?id=${project.companyId}`}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            ← Back to projects
          </Link>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {project.name}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {project.platform} · {currency}
            {range && ` · ${rangeLabel(range)}`}
            {hasData && ` · ${files.length} sheet(s) · ${formatNumber(rawRecords.length)} records`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving && <span className="text-xs text-slate-500">Saving…</span>}
          {hasData && (
            <>
              <button
                type="button"
                onClick={() => setShowUpload((v) => !v)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {uploadOpen ? "Close upload" : "Upload sheets"}
              </button>
              <button
                type="button"
                onClick={() => exportRecordsCsv(records, `${project.name.replace(/\W+/g, "-")}.csv`)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete every uploaded sheet and record for this project?")) {
                    clearData();
                  }
                }}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Clear data
              </button>
            </>
          )}
        </div>
      </div>

      {GA4_SYNC_ENABLED && uploadOpen && (
        <FirebaseSync
          projectId={projectId}
          initialPropertyId={project.ga4PropertyId}
          onSynced={() => load(projectId)}
        />
      )}

      {uploadOpen && (
        <UploadPanel
          hasData={hasData}
          staged={staged}
          isProcessing={isProcessing}
          saving={saving}
          onFiles={addFiles}
          onSamples={loadSampleFiles}
          onRemove={removeStaged}
          onProcess={async () => {
            await processStaged();
            setShowUpload(false);
          }}
        />
      )}

      {hasData && (
        <>
          <div role="tablist" aria-label="Report sections" className="flex gap-1 border-b border-slate-200">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                role="tab"
                type="button"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === entry.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <OverviewTab
              records={records}
              currency={currency}
              weeks={weeks}
              countries={countries}
              weeklySpend={weeklySpend}
              onSpend={setWeeklySpend}
              issues={issues}
              files={files}
            />
          )}
          {tab === "weekly" && (
            <WeeklyTab
              records={records}
              weeks={weeks}
              currency={currency}
              weekStart={project.weekStart ?? "sunday"}
              onWeekStart={setProjectWeekStart}
            />
          )}
          {tab === "builds" && (
            <BuildsTab records={records} builds={builds} currency={currency} />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

function UploadPanel({
  hasData,
  staged,
  isProcessing,
  saving,
  onFiles,
  onSamples,
  onRemove,
  onProcess,
}: {
  hasData: boolean;
  staged: ReturnType<typeof useWorkspace.getState>["staged"];
  isProcessing: boolean;
  saving: boolean;
  onFiles: (files: File[]) => void;
  onSamples: () => void;
  onRemove: (id: string) => void;
  onProcess: () => void;
}) {
  const usable = staged.filter((f) => f.status !== "error");

  return (
    <Card
      title={hasData ? "Upload more sheets" : "Upload KPI sheets"}
      question={
        hasData
          ? "New weeks are added to this project's history."
          : "Drop this game's exports — DAU, retention, playtime, ad revenue."
      }
    >
      <Dropzone onFiles={onFiles} busy={isProcessing} />

      <p className="mt-2 text-center text-xs text-slate-500">
        No export handy?{" "}
        <button
          type="button"
          onClick={onSamples}
          disabled={isProcessing}
          className="font-medium text-blue-700 underline hover:text-blue-800 disabled:opacity-50"
        >
          Load the bundled sample files
        </button>
      </p>

      {isProcessing && (
        <div className="mt-3">
          <LoadingState label="Reading files…" />
        </div>
      )}

      {staged.length > 0 && (
        <>
          <ul className="mt-3 divide-y divide-slate-100">
            {staged.map((file) => (
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
                  <Badge tone="neutral">Dates taken from the other sheets</Badge>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onProcess}
            disabled={usable.length === 0 || saving}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : hasData ? "Add to project" : "Generate report"}
          </button>
        </>
      )}

      {staged.length === 0 && !hasData && (
        <div className="mt-4">
          <ExpectedFilesTable />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewTab({
  records,
  currency,
  weeks,
  countries,
  weeklySpend,
  onSpend,
  issues,
  files,
}: {
  records: Parameters<typeof kpisFor>[0];
  currency: string;
  weeks: string[];
  countries: string[];
  weeklySpend: Record<string, number>;
  onSpend: (week: string, value: number | null) => void;
  issues: { id: string; severity: string; category: string; description: string; resolution: string }[];
  files: { id: string; name: string }[];
}) {
  // Later half versus earlier half, so the boxes carry a comparison from one upload.
  const { firstHalf, secondHalf } = useMemo(() => {
    const dates = Array.from(new Set(records.map((r) => r.date).filter(Boolean))).sort() as string[];
    if (dates.length < 6) return { firstHalf: [], secondHalf: records };
    const mid = dates[Math.floor(dates.length / 2)];
    return {
      firstHalf: records.filter((r) => r.date && r.date < mid),
      secondHalf: records.filter((r) => r.date && r.date >= mid),
    };
  }, [records]);

  const alerts = useMemo(
    () =>
      generateAlerts({
        current: firstHalf.length > 0 ? secondHalf : records,
        previous: firstHalf,
        periodLabel: "the later half of the period",
        comparisonLabel: "the earlier half",
        currency,
      }),
    [records, firstHalf, secondHalf, currency]
  );

  const warnings = issues.filter((i) => i.severity !== "info");

  return (
    <div className="space-y-4">
      <SixBoxes records={records} compareRecords={firstHalf} currency={currency} />

      <Card
        title="Spend"
        question="What did user acquisition cost each week?"
        tooltip="No analytics export carries UA spend, so enter it per week here. Spend is spread evenly across that week's days, which makes ROAS, profit and CPI correct for any slice of the period."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {weeks.map((week) => {
            const wr = weekRange(week);
            return (
              <label key={week} className="block">
                <span className="block text-xs font-medium text-slate-600">
                  {weekLabel(week)}
                  {wr && <span className="text-slate-400"> · {rangeLabel(wr)}</span>}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="text-sm text-slate-400">{currency}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={weeklySpend[week] ?? ""}
                    placeholder="0.00"
                    onBlur={(e) =>
                      onSpend(week, e.target.value === "" ? null : Number(e.target.value))
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </span>
              </label>
            );
          })}
        </div>
        {Object.keys(weeklySpend).length === 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Spend, ROAS, profit and CPI stay N/A until a figure is entered.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          id="ov-dau"
          title="DAU"
          question="Is the active player base growing?"
          records={records}
          metrics={["dau"]}
          granularity="daily"
          currency={currency}
        />
        <TrendChart
          id="ov-revenue"
          title="Revenue"
          question="Is daily revenue rising or falling?"
          records={records}
          metrics={["totalRevenue"]}
          granularity="daily"
          currency={currency}
        />
        <RetentionCurve
          id="ov-retention"
          records={records}
          title="Retention curve (D1–D7)"
          question="How quickly do new players stop coming back?"
        />
        <TrendChart
          id="ov-playtime"
          title="Playtime per user"
          question="Are sessions getting longer or shorter?"
          records={records}
          metrics={["playtimePerUserSeconds"]}
          granularity="daily"
          currency={currency}
        />
      </div>

      {countries.length >= 2 && (
        <RankedBarChart
          id="ov-country"
          title="Country comparison"
          question="Which markets keep and monetize players best?"
          records={records}
          dimension="country"
          metrics={["retentionD1", "dau", "arpdau", "totalRevenue"]}
          currency={currency}
        />
      )}

      <AlertsPanel alerts={alerts} title="What stands out" />

      {(warnings.length > 0 || issues.length > 0) && (
        <Card title={`Data notes (${issues.length})`}>
          <ul className="space-y-1.5">
            {issues.slice(0, 12).map((issue) => (
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
                <span className="font-semibold">{issue.category}:</span> {issue.description}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            From {files.length} uploaded sheet{files.length === 1 ? "" : "s"}.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly comparison                                                   */
/* ------------------------------------------------------------------ */

function WeeklyTab({
  records,
  weeks,
  currency,
  weekStart,
  onWeekStart,
}: {
  records: Parameters<typeof kpisFor>[0];
  weeks: string[];
  currency: string;
  weekStart: WeekStart;
  onWeekStart: (start: WeekStart) => void;
}) {
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);
  const weekB = pickedB && weeks.includes(pickedB) ? pickedB : (weeks[weeks.length - 1] ?? "");
  const weekA =
    pickedA && weeks.includes(pickedA) ? pickedA : (weeks[weeks.length - 2] ?? weeks[0] ?? "");

  const recordsA = useMemo(() => records.filter((r) => r.week === weekA), [records, weekA]);
  const recordsB = useMemo(() => records.filter((r) => r.week === weekB), [records, weekB]);

  const columns: ComparisonColumn[] = useMemo(() => {
    const a = kpisFor(recordsA);
    const b = kpisFor(recordsB);
    return [
      { key: weekA, label: weekLabel(weekA), values: a, sampleDays: a.dayCount, sampleUsers: a.dauTotal },
      { key: weekB, label: weekLabel(weekB), values: b, sampleDays: b.dayCount, sampleUsers: b.dauTotal },
    ];
  }, [recordsA, recordsB, weekA, weekB]);

  // Comparing a part-week against a full one makes every total misleading.
  const [thinWeek, thinWeekDays] = useMemo(() => {
    for (const [key, rows] of [
      [weekA, recordsA],
      [weekB, recordsB],
    ] as const) {
      const days = new Set(rows.map((r) => r.date).filter(Boolean)).size;
      if (days > 0 && days < 7) return [weekLabel(key), days] as const;
    }
    return [null, 0] as const;
  }, [weekA, weekB, recordsA, recordsB]);

  if (weeks.length < 2) {
    return (
      <Card title="Weekly Comparison">
        <p className="py-8 text-center text-sm text-slate-500">
          Only {weeks.length} week of data so far. Upload another week&apos;s sheets to compare.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="week-a" className="block text-xs font-medium text-slate-600">
            Baseline week
          </label>
          <select
            id="week-a"
            value={weekA}
            onChange={(e) => setPickedA(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>
                {weekLabelWithRange(w)}
              </option>
            ))}
          </select>
        </div>
        <span aria-hidden="true" className="pb-2 text-sm text-slate-400">vs</span>
        <div>
          <label htmlFor="week-b" className="block text-xs font-medium text-slate-600">
            Compared week
          </label>
          <select
            id="week-b"
            value={weekB}
            onChange={(e) => setPickedB(e.target.value)}
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
          <label htmlFor="week-start" className="block text-xs font-medium text-slate-600">
            Week starts on
          </label>
          <select
            id="week-start"
            value={weekStart}
            onChange={(e) => onWeekStart(e.target.value as WeekStart)}
            className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="sunday">Sunday (Google Ads, GA4)</option>
            <option value="monday">Monday (ISO)</option>
          </select>
        </div>
      </div>

      {thinWeek && (
        <p
          role="note"
          className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20"
        >
          {thinWeek} covers only {thinWeekDays} day(s) of data, so totals such as spend and revenue
          are not comparable with a full week. If your exports run Sunday to Saturday, set the week
          start to Sunday.
        </p>
      )}

      <SixBoxes records={recordsB} compareRecords={recordsA} currency={currency} />

      <KpiComparisonTable
        columns={columns}
        currency={currency}
        title={`${weekLabel(weekA)} versus ${weekLabel(weekB)}`}
        question="Which KPIs moved between these two weeks?"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          id="wk-dau"
          title="DAU by week"
          question="How has the player base moved week to week?"
          records={records}
          metrics={["dau"]}
          granularity="weekly"
          currency={currency}
        />
        <TrendChart
          id="wk-revenue"
          title="Revenue by week"
          question="Is weekly revenue trending up?"
          records={records}
          metrics={["totalRevenue"]}
          granularity="weekly"
          currency={currency}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Build comparison                                                    */
/* ------------------------------------------------------------------ */

function BuildsTab({
  records,
  builds,
  currency,
}: {
  records: Parameters<typeof kpisFor>[0];
  builds: string[];
  currency: string;
}) {
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);
  const buildB = pickedB && builds.includes(pickedB) ? pickedB : (builds[builds.length - 1] ?? "");
  const buildA =
    pickedA && builds.includes(pickedA) ? pickedA : (builds[builds.length - 2] ?? builds[0] ?? "");

  const recordsA = useMemo(() => records.filter((r) => r.build === buildA), [records, buildA]);
  const recordsB = useMemo(() => records.filter((r) => r.build === buildB), [records, buildB]);
  const pair = useMemo(
    () => records.filter((r) => r.build === buildA || r.build === buildB),
    [records, buildA, buildB]
  );

  const columns: ComparisonColumn[] = useMemo(() => {
    const a = kpisFor(recordsA);
    const b = kpisFor(recordsB);
    return [
      { key: buildA, label: `Build ${buildA}`, values: a, sampleDays: a.dayCount, sampleUsers: a.dauTotal },
      { key: buildB, label: `Build ${buildB}`, values: b, sampleDays: b.dayCount, sampleUsers: b.dauTotal },
    ];
  }, [recordsA, recordsB, buildA, buildB]);

  const summary = useMemo(() => groupedKpis(records, "build"), [records]);

  if (builds.length < 2) {
    return (
      <Card title="Build Comparison">
        <p className="py-8 text-center text-sm text-slate-500">
          {builds.length === 0
            ? "No build information in the uploaded sheets. A DAU or playtime export with one column per build unlocks this tab."
            : `Only build ${builds[0]} is present. Two builds are needed to compare.`}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="build-a" className="block text-xs font-medium text-slate-600">
            Build A (baseline)
          </label>
          <select
            id="build-a"
            value={buildA}
            onChange={(e) => setPickedA(e.target.value)}
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
            onChange={(e) => setPickedB(e.target.value)}
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

      <SixBoxes records={recordsB} compareRecords={recordsA} currency={currency} />

      <KpiComparisonTable
        columns={columns}
        currency={currency}
        title={`Build ${buildA} versus build ${buildB}`}
        question="Did the newer build improve or damage the KPIs?"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          id="bd-dau"
          title="DAU by build"
          question="How is the player base split between builds?"
          records={pair}
          metrics={["dau"]}
          splitBy="build"
          granularity="daily"
          currency={currency}
        />
        <RetentionCurve
          id="bd-retention"
          records={pair}
          splitBy="build"
          title="Retention curve by build"
          question="Where in the first week does each build lose players?"
        />
      </div>

      <Card title="All builds" question="How does every build compare?">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Per-build KPI summary</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-medium">Build</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Avg DAU</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">D1</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Playtime/user</th>
                <th scope="col" className="py-2 text-right font-medium">ARPDAU</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((group) => (
                <tr
                  key={group.key}
                  className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                >
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                    {group.key}
                  </th>
                  <td className="tabular py-2 pr-3 text-right">
                    {group.dau === null ? "N/A" : formatNumber(Math.round(group.dau))}
                  </td>
                  <td className="tabular py-2 pr-3 text-right">
                    {group.retentionD1 === null ? "N/A" : `${group.retentionD1.toFixed(1)}%`}
                  </td>
                  <td className="tabular py-2 pr-3 text-right">
                    {group.playtimePerUserSeconds === null
                      ? "N/A"
                      : `${Math.round(group.playtimePerUserSeconds / 60)}m`}
                  </td>
                  <td className="tabular py-2 text-right">
                    {formatCurrencyPrecise(group.arpdau, currency, 4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
