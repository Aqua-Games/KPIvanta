"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiRecord } from "@/lib/types";
import { KPI_BY_ID, KpiId, formatKpi } from "@/lib/kpi";
import { groupedKpis } from "@/lib/select";
import { Card } from "../ui/Card";
import { TOKENS, axisFormatter, exportChartPng, seriesColor } from "./chartUtils";

/**
 * Horizontal ranked comparison across a dimension. Sorted best-to-worst for the
 * selected metric, respecting whether higher or lower is better.
 */
export function RankedBarChart({
  id,
  title,
  question,
  records,
  dimension,
  metrics,
  currency,
  onSelect,
  height = 260,
}: {
  id: string;
  title: string;
  question: string;
  records: KpiRecord[];
  dimension: keyof KpiRecord;
  metrics: KpiId[];
  currency: string;
  onSelect?: (key: string) => void;
  height?: number;
}) {
  const [metric, setMetric] = useState<KpiId>(metrics[0]);

  const data = useMemo(() => {
    const definition = KPI_BY_ID[metric];
    const lowerBetter = definition?.direction === "lower_better";
    return groupedKpis(records, dimension)
      .map((group) => ({ key: group.key, value: group[metric], records: group.records.length }))
      .filter((row) => row.value !== null)
      .sort((a, b) =>
        lowerBetter ? (a.value ?? 0) - (b.value ?? 0) : (b.value ?? 0) - (a.value ?? 0)
      );
  }, [records, dimension, metric]);

  return (
    <Card
      id={id}
      title={title}
      question={question}
      fullscreenable
      actions={
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Metric" className="flex rounded-md border border-slate-200">
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={`px-2 py-1 text-xs font-medium first:rounded-l-md last:rounded-r-md ${
                  metric === m ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {KPI_BY_ID[m]?.label ?? m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => exportChartPng(id, `${id}.png`)}
            className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            PNG
          </button>
        </div>
      }
    >
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {KPI_BY_ID[metric]?.label ?? metric} is not reported for any group in the current selection.
        </p>
      ) : (
        <div style={{ height: Math.max(height, data.length * 34 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
              onClick={(state) => {
                const key = state?.activeLabel;
                if (key && onSelect) onSelect(String(key));
              }}
            >
              <CartesianGrid horizontal={false} stroke={TOKENS.grid} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={axisFormatter(metric, currency)}
              />
              <YAxis
                type="category"
                dataKey="key"
                width={150}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                formatter={(value) => [
                  formatKpi(metric, typeof value === "number" ? value : null, currency),
                  KPI_BY_ID[metric]?.label ?? metric,
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {data.map((entry, index) => (
                  <Cell key={entry.key} fill={seriesColor(index)} cursor={onSelect ? "pointer" : "default"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {onSelect && data.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">Select a bar to filter the dashboard to it.</p>
      )}
    </Card>
  );
}
