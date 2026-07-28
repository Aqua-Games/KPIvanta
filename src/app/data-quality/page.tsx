"use client";

import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { usePageTitle } from "@/components/usePageTitle";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { countBySeverity } from "@/lib/validation";
import { IssueSeverity, KpiRecord } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { completeness } from "@/lib/select";
import { toCsv, download } from "@/lib/exportCsv";

const SEVERITY_TONE: Record<IssueSeverity, "negative" | "warning" | "neutral"> = {
  error: "negative",
  warning: "warning",
  info: "neutral",
};

/** Fields whose coverage decides which KPIs the dashboard can compute. */
const COVERAGE_FIELDS: { field: keyof KpiRecord; label: string; unlocks: string }[] = [
  { field: "dau", label: "DAU", unlocks: "Every per-user KPI: ARPDAU, IMPDAU, sessions per user" },
  { field: "retentionD1", label: "D1 retention", unlocks: "D1 retention and the retention curve" },
  { field: "retentionD2", label: "D2 retention", unlocks: "D2 retention on the curve and comparison tables" },
  { field: "retentionD3", label: "D3 retention", unlocks: "D3 retention KPI" },
  { field: "retentionD4", label: "D4 retention", unlocks: "D4 retention on the curve and comparison tables" },
  { field: "retentionD5", label: "D5 retention", unlocks: "D5 retention on the curve and comparison tables" },
  { field: "retentionD6", label: "D6 retention", unlocks: "D6 retention on the curve and comparison tables" },
  { field: "retentionD7", label: "D7 retention", unlocks: "D7 retention and cohort maturity" },
  { field: "playtimeSecondsPerUser", label: "Playtime per user", unlocks: "Playtime KPIs" },
  { field: "adRevenue", label: "Ad revenue", unlocks: "ARPDAU Ads, eCPM, revenue trends" },
  { field: "iapRevenue", label: "IAP revenue", unlocks: "ARPDAU IAP and revenue split" },
  { field: "adImpressions", label: "Ad impressions", unlocks: "IMPDAU, eCPM, show rate" },
  { field: "sessions", label: "Sessions", unlocks: "Sessions per user, crash rate, ANR rate" },
  { field: "crashes", label: "Crashes", unlocks: "Crash rate" },
  { field: "anrs", label: "ANRs", unlocks: "ANR rate" },
  { field: "levelCompletions", label: "Level completions", unlocks: "Level completion percentage" },
];

export default function DataQualityPage() {
  usePageTitle("Data Quality");
  const { hydrated, issues, allRecords, files, isDemo } = useData();
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "all">("all");
  const [excluded, setExcluded] = useState<string[]>([]);

  const counts = countBySeverity(issues);

  const visible = useMemo(
    () =>
      issues.filter(
        (issue) => severityFilter === "all" || issue.severity === severityFilter
      ),
    [issues, severityFilter]
  );

  const coverage = useMemo(
    () =>
      COVERAGE_FIELDS.map((entry) => ({
        ...entry,
        percent: completeness(allRecords, entry.field),
      })),
    [allRecords]
  );

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-white" aria-hidden="true" />;
  }

  if (allRecords.length === 0) {
    return (
      <EmptyState
        title="Nothing to validate yet"
        description="Import a file and every row is checked for structural, range and consistency problems."
        action={{ href: "/import", label: "Go to Data Import" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Data Quality</h2>
          <p className="text-sm text-slate-500">
            Structural, range and consistency checks across{" "}
            {isDemo ? "the demo dataset" : `${files.length} imported file(s)`}.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            download(
              "data-quality-issues.csv",
              toCsv(
                ["severity", "category", "description", "resolution", "source", "row"],
                issues.map((i) => [
                  i.severity,
                  i.category,
                  i.description,
                  i.resolution,
                  i.sourceFile,
                  i.rowNumber ?? "",
                ])
              )
            )
          }
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export issues
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Errors" value={counts.error} tone="negative" hint="Block or distort analysis" />
        <CountCard label="Warnings" value={counts.warning} tone="warning" hint="Worth checking before you act" />
        <CountCard label="Notes" value={counts.info} tone="neutral" hint="Context, no action required" />
        <CountCard
          label="Records checked"
          value={allRecords.length}
          tone="primary"
          hint="Every stored record"
        />
      </div>

      <Card
        title="Metric coverage"
        question="Which KPIs can this database actually support?"
        tooltip="Share of stored records that carry each field. A field reported by no record leaves its KPIs as N/A rather than zero."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">Field coverage across the database</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-medium">Field</th>
                <th scope="col" className="py-2 pr-3 font-medium">Coverage</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Records</th>
                <th scope="col" className="py-2 font-medium">Unlocks</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={String(row.field)} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                    {row.label}
                  </th>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded bg-slate-100">
                        <div
                          className={`h-full rounded ${
                            row.percent >= 60
                              ? "bg-emerald-500"
                              : row.percent > 0
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${Math.max(row.percent, 1.5)}%` }}
                        />
                      </div>
                      <span className="tabular text-xs text-slate-600">
                        {formatPercent(row.percent, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="tabular py-2 pr-3 text-right text-slate-600">
                    {formatNumber(Math.round((row.percent / 100) * allRecords.length))}
                  </td>
                  <td className="py-2 text-slate-600">
                    {row.percent === 0 ? (
                      <span className="text-slate-400">Not reported — {row.unlocks} unavailable</span>
                    ) : (
                      row.unlocks
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          The dashboard distinguishes a valid zero from a missing value, a metric a source does not
          apply, and a parsing error. Only the first is ever charted as zero.
        </p>
      </Card>

      <Card
        title={`Issues (${visible.length})`}
        question="What needs correcting before these numbers are trusted?"
        actions={
          <div role="group" aria-label="Filter by severity" className="flex rounded-md border border-slate-200">
            {(["all", "error", "warning", "info"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSeverityFilter(option)}
                aria-pressed={severityFilter === option}
                className={`px-2.5 py-1 text-xs font-medium capitalize first:rounded-l-md last:rounded-r-md ${
                  severityFilter === option
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        }
      >
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No issues at this severity. The database passed every check in this category.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <caption className="sr-only">Data quality issues</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-medium">Severity</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Category</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Problem</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Suggested resolution</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Row</th>
                  <th scope="col" className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 200).map((issue) => {
                  const isExcluded = excluded.includes(issue.id);
                  return (
                    <tr
                      key={issue.id}
                      className={`border-b border-slate-100 last:border-0 ${
                        isExcluded ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge>
                      </td>
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                        {issue.category}
                      </th>
                      <td className="py-2 pr-3 text-slate-600">{issue.description}</td>
                      <td className="py-2 pr-3 text-slate-500">{issue.resolution}</td>
                      <td className="py-2 pr-3 text-slate-500">{issue.sourceFile}</td>
                      <td className="tabular py-2 pr-3 text-right text-slate-500">
                        {issue.rowNumber ?? "—"}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExcluded((list) =>
                              list.includes(issue.id)
                                ? list.filter((id) => id !== issue.id)
                                : [...list, issue.id]
                            )
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {isExcluded ? "Restore" : "Acknowledge"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length > 200 && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the first 200 of {visible.length} issues. Export the full list to review them
                all.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function CountCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "negative" | "warning" | "neutral" | "primary";
  hint: string;
}) {
  const color =
    tone === "negative"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "primary"
          ? "text-blue-700"
          : "text-slate-700";
  return (
    <div className="panel p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${color}`}>{formatNumber(value)}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
