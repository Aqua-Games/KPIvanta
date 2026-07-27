"use client";

import clsx from "clsx";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { InfoTooltip } from "./ui/InfoTooltip";

export interface KpiCardProps {
  label: string;
  value: string;
  comparisonValue?: string;
  absoluteChange?: string;
  percentChange: number | null;
  status: "positive" | "negative" | "neutral";
  sparkline: { date: string; value: number | null }[];
  formula: string;
  dataSource: string;
  completeness: number;
  lowerIsBetter?: boolean;
}

const STATUS_TEXT: Record<KpiCardProps["status"], string> = {
  positive: "text-emerald-600",
  negative: "text-red-600",
  neutral: "text-slate-500",
};

const STATUS_STROKE: Record<KpiCardProps["status"], string> = {
  positive: "#059669",
  negative: "#dc2626",
  neutral: "#64748b",
};

export function KpiCard({
  label,
  value,
  comparisonValue,
  absoluteChange,
  percentChange,
  status,
  sparkline,
  formula,
  dataSource,
  completeness,
  lowerIsBetter,
}: KpiCardProps) {
  const changeLabel =
    percentChange === null
      ? "No comparison data"
      : `${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%`;

  return (
    <article className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
          <InfoTooltip
            label={`${label} definition`}
            content={`${formula} · Source: ${dataSource}${lowerIsBetter ? " · A decrease is favourable." : ""}`}
          />
        </h3>
        <CompletenessDot completeness={completeness} />
      </div>

      <p className="tabular mt-2 text-2xl font-semibold text-slate-900">{value}</p>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className={clsx("font-medium tabular", STATUS_TEXT[status])}>{changeLabel}</span>
        {absoluteChange && <span className="tabular text-slate-500">{absoluteChange}</span>}
        {comparisonValue && (
          <span className="text-slate-400">vs {comparisonValue}</span>
        )}
      </div>

      <div className="mt-3 h-8" aria-hidden="true">
        {sparkline.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={STATUS_STROKE[status]}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center text-[11px] text-slate-400">
            Not enough data for a trend
          </div>
        )}
      </div>
    </article>
  );
}

function CompletenessDot({ completeness }: { completeness: number }) {
  const tone =
    completeness >= 95 ? "bg-emerald-500" : completeness >= 60 ? "bg-amber-500" : "bg-red-500";
  const text =
    completeness >= 95
      ? "Complete data"
      : completeness >= 60
        ? "Partially complete data"
        : "Sparse data";
  return (
    <span className="group relative flex items-center gap-1" title={`${text}: ${completeness.toFixed(0)}% of rows carry this metric`}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", tone)} />
      <span className="text-[10px] tabular text-slate-400">{completeness.toFixed(0)}%</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
