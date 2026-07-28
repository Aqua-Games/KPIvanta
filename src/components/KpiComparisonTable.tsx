"use client";

import clsx from "clsx";
import {
  ChangeStatus,
  KPI_DEFINITIONS,
  KpiId,
  KpiValues,
  absoluteChange,
  changeStatus,
  formatKpi,
  percentChange,
} from "@/lib/kpi";
import { formatSignedPercent } from "@/lib/format";
import { InfoTooltip } from "./ui/InfoTooltip";
import { Card } from "./ui/Card";

export interface ComparisonColumn {
  key: string;
  label: string;
  values: KpiValues;
  /** Sample size behind the column, used to warn on thin data. */
  sampleDays: number;
  sampleUsers: number | null;
}

const STATUS_CELL: Record<ChangeStatus, string> = {
  improved: "bg-emerald-50 text-emerald-700",
  worse: "bg-red-50 text-red-700",
  same: "bg-slate-50 text-slate-600",
  unknown: "bg-white text-slate-400",
};

const STATUS_LABEL: Record<ChangeStatus, string> = {
  improved: "Improved",
  worse: "Worse",
  same: "Unchanged",
  unknown: "No comparison",
};

/**
 * KPI rows against comparison columns. The last column is compared with the
 * first, and every cell states the direction in text as well as colour.
 */
export function KpiComparisonTable({
  columns,
  currency,
  minSampleUsers = 100,
  minSampleDays = 3,
  title = "KPI comparison",
  question,
  groups,
}: {
  columns: ComparisonColumn[];
  currency: string;
  minSampleUsers?: number;
  minSampleDays?: number;
  title?: string;
  question?: string;
  groups?: KpiId[];
}) {
  const baseline = columns[0];
  const target = columns[columns.length - 1];
  const rows = KPI_DEFINITIONS.filter((definition) =>
    groups ? groups.includes(definition.id) : true
  ).filter((definition) =>
    // Hide a KPI that no column reports at all.
    columns.some((column) => column.values[definition.id] !== null)
  );

  const thinColumns = columns.filter(
    (c) => c.sampleDays < minSampleDays || (c.sampleUsers !== null && c.sampleUsers < minSampleUsers)
  );

  return (
    <Card title={title} question={question} fullscreenable>
      {thinColumns.length > 0 && (
        <p
          role="note"
          className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20"
        >
          Small sample: {thinColumns.map((c) => c.label).join(", ")} cover fewer than {minSampleDays}{" "}
          days or {minSampleUsers} users. Differences may not be meaningful.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            KPI values per column, with the change between {baseline?.label} and {target?.label}
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                KPI
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="py-2 pr-3 text-right font-medium">
                  {column.label}
                </th>
              ))}
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Difference
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((definition) => {
              const from = baseline?.values[definition.id] ?? null;
              const to = target?.values[definition.id] ?? null;
              const change = percentChange(to, from);
              const absolute = absoluteChange(to, from);
              const status = changeStatus(definition.id, change);

              return (
                <tr key={definition.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                    <span className="flex items-center gap-1.5">
                      {definition.label}
                      <InfoTooltip
                        label={`How ${definition.label} is calculated`}
                        content={`${definition.formula}.${
                          definition.direction === "lower_better"
                            ? " A decrease is an improvement."
                            : ""
                        }`}
                      />
                    </span>
                  </th>
                  {columns.map((column) => (
                    <td key={column.key} className="tabular py-2 pr-3 text-right text-slate-900">
                      {formatKpi(definition.id, column.values[definition.id], currency)}
                    </td>
                  ))}
                  <td className="tabular py-2 pr-3 text-right text-slate-600">
                    {absolute === null
                      ? "N/A"
                      : `${absolute > 0 ? "+" : ""}${formatKpi(definition.id, absolute, currency)}`}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={clsx(
                        "tabular inline-block min-w-[84px] rounded px-2 py-0.5 text-xs font-medium",
                        STATUS_CELL[status]
                      )}
                    >
                      {change === null ? "N/A" : formatSignedPercent(change)}
                      <span className="sr-only"> — {STATUS_LABEL[status]}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          None of the selected columns report a comparable KPI.
        </p>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Green means improved, red means worse and grey means unchanged (within ±2%). A KPI that a
        source does not report is shown as N/A rather than zero.
      </p>
    </Card>
  );
}
