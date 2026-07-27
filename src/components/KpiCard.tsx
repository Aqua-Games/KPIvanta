"use client";

import clsx from "clsx";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { InfoTooltip } from "./ui/InfoTooltip";
import { ChangeStatus, KpiDefinition, formatKpi } from "@/lib/kpi";
import { formatSignedPercent } from "@/lib/format";

export interface KpiCardProps {
  definition: KpiDefinition;
  value: number | null;
  comparisonValue: number | null;
  percentChange: number | null;
  status: ChangeStatus;
  sparkline: { bucket: string; value: number | null }[];
  currency: string;
  /** Share of records in scope that carry this metric, 0-100. */
  completeness: number;
  sourceLabel: string;
  note?: string;
}

const STATUS_TEXT: Record<ChangeStatus, string> = {
  improved: "text-emerald-600",
  worse: "text-red-600",
  same: "text-slate-500",
  unknown: "text-slate-400",
};

const STROKE: Record<ChangeStatus, string> = {
  improved: "#059669",
  worse: "#dc2626",
  same: "#64748b",
  unknown: "#94a3b8",
};

export function KpiCard({
  definition,
  value,
  comparisonValue,
  percentChange,
  status,
  sparkline,
  currency,
  completeness,
  sourceLabel,
  note,
}: KpiCardProps) {
  const hasSparkline = sparkline.filter((p) => p.value !== null).length > 1;

  return (
    <article className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {definition.shortLabel ?? definition.label}
          <InfoTooltip
            label={`How ${definition.label} is calculated`}
            content={`${definition.formula}. Source: ${sourceLabel}.${
              definition.direction === "lower_better" ? " A decrease is an improvement." : ""
            }${note ? ` ${note}` : ""}`}
          />
        </h3>
        <Completeness value={completeness} />
      </div>

      <p className="tabular mt-2 text-2xl font-semibold text-slate-900">
        {formatKpi(definition.id, value, currency)}
      </p>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className={clsx("tabular font-medium", STATUS_TEXT[status])}>
          {percentChange === null ? "No comparison" : formatSignedPercent(percentChange)}
        </span>
        {comparisonValue !== null && (
          <span className="text-slate-400">
            vs {formatKpi(definition.id, comparisonValue, currency)}
          </span>
        )}
      </div>

      <div className="mt-3 h-8" aria-hidden="true">
        {hasSparkline ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={STROKE[status]}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center text-[11px] text-slate-400">
            Not enough points for a trend
          </p>
        )}
      </div>
    </article>
  );
}

function Completeness({ value }: { value: number }) {
  const tone = value >= 95 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  const description =
    value >= 95
      ? "Reported by nearly every record in scope"
      : value >= 50
        ? "Reported by some records in scope"
        : "Reported by few records in scope";
  return (
    <span className="flex items-center gap-1" title={`${description} (${value.toFixed(0)}%)`}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", tone)} />
      <span className="tabular text-[10px] text-slate-400">{value.toFixed(0)}%</span>
      <span className="sr-only">Data completeness: {description}</span>
    </span>
  );
}
