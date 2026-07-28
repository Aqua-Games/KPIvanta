"use client";

import clsx from "clsx";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
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

const DELTA_CHIP: Record<ChangeStatus, string> = {
  improved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  worse: "bg-red-50 text-red-700 ring-red-600/20",
  same: "bg-slate-100 text-slate-600 ring-slate-500/20",
  unknown: "bg-slate-50 text-slate-400 ring-slate-400/20",
};

const DELTA_ARROW: Record<ChangeStatus, string> = {
  improved: "▴",
  worse: "▾",
  same: "▸",
  unknown: "",
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
  const stroke = STROKE[status];
  const gradientId = `spark-${definition.id}`;

  return (
    <article className="panel group flex flex-col p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="tabular text-[26px] font-semibold leading-none tracking-tight text-slate-900">
          {formatKpi(definition.id, value, currency)}
        </p>
        <span
          className={clsx(
            "tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
            DELTA_CHIP[status]
          )}
        >
          {percentChange === null ? (
            "no comparison"
          ) : (
            <>
              <span aria-hidden="true">{DELTA_ARROW[status]}</span>
              {formatSignedPercent(percentChange)}
              <span className="sr-only">
                {status === "improved" ? "improved" : status === "worse" ? "worse" : "unchanged"}
              </span>
            </>
          )}
        </span>
      </div>

      {comparisonValue !== null && (
        <p className="mt-1 text-[11px] text-slate-400">
          vs {formatKpi(definition.id, comparisonValue, currency)} previous period
        </p>
      )}

      <div className="mt-3 h-9" aria-hidden="true">
        {hasSparkline ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-end text-[11px] text-slate-300">
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
    <span
      className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100"
      title={`${description} (${value.toFixed(0)}%)`}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", tone)} />
      <span className="tabular text-[10px] text-slate-400">{value.toFixed(0)}%</span>
      <span className="sr-only">Data completeness: {description}</span>
    </span>
  );
}
