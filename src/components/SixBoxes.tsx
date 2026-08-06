"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { KpiRecord } from "@/lib/types";
import { KPI_BY_ID, KpiId, changeStatus, formatKpi, kpisFor, percentChange } from "@/lib/kpi";
import { timeSeries } from "@/lib/select";
import { InfoTooltip } from "./ui/InfoTooltip";
import { formatSignedPercent } from "@/lib/format";

/** The six headline boxes the dashboard opens with. */
export const SIX_BOXES: KpiId[] = [
  "dau",
  "playtimePerUserSeconds",
  "retentionD1",
  "spend",
  "totalRevenue",
  "roas",
];

const CHIP: Record<string, string> = {
  improved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  worse: "bg-red-50 text-red-700 ring-red-600/20",
  same: "bg-slate-100 text-slate-600 ring-slate-500/20",
  unknown: "bg-slate-50 text-slate-400 ring-slate-400/20",
};

const ARROW: Record<string, string> = { improved: "▴", worse: "▾", same: "▸", unknown: "" };
const STROKE: Record<string, string> = {
  improved: "#059669",
  worse: "#dc2626",
  same: "#64748b",
  unknown: "#94a3b8",
};

export function SixBoxes({
  records,
  compareRecords,
  currency,
  metrics = SIX_BOXES,
}: {
  records: KpiRecord[];
  compareRecords: KpiRecord[];
  currency: string;
  metrics?: KpiId[];
}) {
  const current = useMemo(() => kpisFor(records), [records]);
  const previous = useMemo(() => kpisFor(compareRecords), [compareRecords]);
  const series = useMemo(() => timeSeries(records, "daily"), [records]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((id) => {
        const definition = KPI_BY_ID[id];
        if (!definition) return null;
        const value = current[id];
        const comparison = compareRecords.length > 0 ? previous[id] : null;
        const change = percentChange(value, comparison);
        const status = changeStatus(id, change);
        const points = series.map((p) => ({ bucket: p.bucket, value: p[id] }));
        const hasTrend = points.filter((p) => p.value !== null).length > 1;
        const gradientId = `six-${id}`;

        return (
          <article key={id} className="panel flex flex-col p-5">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {definition.label}
              <InfoTooltip
                label={`How ${definition.label} is calculated`}
                content={`${definition.formula}.${
                  definition.direction === "lower_better" ? " A decrease is an improvement." : ""
                }`}
              />
            </h3>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="tabular text-3xl font-semibold leading-none tracking-tight text-slate-900">
                {formatKpi(id, value, currency)}
              </p>
              {change !== null && (
                <span
                  className={clsx(
                    "tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                    CHIP[status]
                  )}
                >
                  <span aria-hidden="true">{ARROW[status]}</span>
                  {formatSignedPercent(change)}
                </span>
              )}
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {value === null
                ? "Not reported by the uploaded files"
                : comparison !== null
                  ? `vs ${formatKpi(id, comparison, currency)} in the previous period`
                  : "No comparison period yet"}
            </p>

            <div className="mt-3 h-10" aria-hidden="true">
              {hasTrend && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={STROKE[status]} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={STROKE[status]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={STROKE[status]}
                      strokeWidth={1.5}
                      fill={`url(#${gradientId})`}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
