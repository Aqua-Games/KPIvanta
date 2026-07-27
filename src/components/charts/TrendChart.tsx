"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Granularity, KpiRecord } from "@/lib/types";
import { KPI_BY_ID, KpiId } from "@/lib/kpi";
import { SeriesPoint, groupBy, timeSeries } from "@/lib/select";
import { Card } from "../ui/Card";
import { ChartTooltip } from "./ChartTooltip";
import { TOKENS, axisFormatter, exportChartPng, seriesColor } from "./chartUtils";
import { weekLabel } from "@/lib/week";
import { formatDate } from "@/lib/format";

interface TrendChartProps {
  id: string;
  title: string;
  question: string;
  records: KpiRecord[];
  compareRecords?: KpiRecord[];
  metrics: KpiId[];
  granularity: Granularity;
  currency: string;
  /** Draw one line per distinct value of this dimension instead of one per metric. */
  splitBy?: keyof KpiRecord;
  /** Optional horizontal reference line, e.g. a target. */
  reference?: { value: number; label: string };
  height?: number;
  onPointClick?: (bucket: string) => void;
}

export function TrendChart({
  id,
  title,
  question,
  records,
  compareRecords,
  metrics,
  granularity,
  currency,
  splitBy,
  reference,
  height = 280,
  onPointClick,
}: TrendChartProps) {
  const [hidden, setHidden] = useState<string[]>([]);

  const { data, series } = useMemo(() => {
    if (splitBy) {
      const metric = metrics[0];
      const groups = Array.from(groupBy(records, splitBy).entries()).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      const buckets = new Map<string, Record<string, number | null | string>>();

      groups.forEach(([groupKey, groupRecords]) => {
        timeSeries(groupRecords, granularity).forEach((point) => {
          const row = buckets.get(point.bucket) ?? { bucket: point.bucket };
          row[groupKey] = point[metric];
          buckets.set(point.bucket, row);
        });
      });

      return {
        data: Array.from(buckets.values()).sort((a, b) =>
          String(a.bucket).localeCompare(String(b.bucket))
        ),
        series: groups.map(([groupKey], index) => ({
          key: groupKey,
          label: groupKey,
          color: seriesColor(index),
          metric,
          dashed: false,
        })),
      };
    }

    const current = timeSeries(records, granularity);
    const compare = compareRecords?.length ? timeSeries(compareRecords, granularity) : [];

    const data = current.map((point, index) => {
      const row: Record<string, number | null | string> = { bucket: point.bucket };
      metrics.forEach((metric) => {
        row[metric] = point[metric];
      });
      // The comparison period is aligned by position, not by date, so the two
      // windows line up even when they have different calendar dates.
      if (compare.length > 0) {
        const comparePoint: SeriesPoint | undefined = compare[index];
        metrics.forEach((metric) => {
          row[`${metric}__compare`] = comparePoint ? comparePoint[metric] : null;
        });
      }
      return row;
    });

    const series = metrics.map((metric, index) => ({
      key: metric as string,
      label: KPI_BY_ID[metric]?.label ?? metric,
      color: seriesColor(index),
      metric,
      dashed: false,
    }));

    if (compare.length > 0) {
      metrics.forEach((metric, index) => {
        series.push({
          key: `${metric}__compare`,
          label: `${KPI_BY_ID[metric]?.label ?? metric} (comparison)`,
          color: seriesColor(index),
          metric,
          dashed: true,
        });
      });
    }

    return { data, series };
  }, [records, compareRecords, metrics, granularity, splitBy]);

  const formatBucket = (bucket: string) =>
    granularity === "weekly" ? weekLabel(bucket) : formatDate(bucket);

  const metricFor = (dataKey: string): KpiId => {
    const match = series.find((s) => s.key === dataKey);
    return (match?.metric ?? metrics[0]) as KpiId;
  };

  const visible = series.filter((s) => !hidden.includes(s.key));
  const axisMetric = metrics[0];

  if (data.length === 0) {
    return (
      <Card id={id} title={title} question={question}>
        <p className="py-10 text-center text-sm text-slate-500">
          No data available for this chart under the current filters.
        </p>
      </Card>
    );
  }

  return (
    <Card
      id={id}
      title={title}
      question={question}
      fullscreenable
      actions={
        <button
          type="button"
          onClick={() => exportChartPng(id, `${id}.png`)}
          className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          PNG
        </button>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const isHidden = hidden.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={!isHidden}
              onClick={() =>
                setHidden((h) => (h.includes(s.key) ? h.filter((k) => k !== s.key) : [...h, s.key]))
              }
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                isHidden ? "border-slate-200 text-slate-400" : "border-slate-300 bg-slate-50 text-slate-700"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ background: isHidden ? "#cbd5e1" : s.color }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 6, right: 12, bottom: 4, left: 0 }}
            onClick={(state) => {
              const bucket = state?.activeLabel;
              if (bucket && onPointClick) onPointClick(String(bucket));
            }}
          >
            <CartesianGrid vertical={false} stroke={TOKENS.grid} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tickFormatter={(value: string) =>
                granularity === "weekly" ? value.replace(/^\d{4}-/, "") : value.slice(5)
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={axisFormatter(axisMetric, currency)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  currency={currency}
                  metricFor={metricFor}
                  labelFormatter={formatBucket}
                />
              }
            />
            {reference && (
              <ReferenceLine
                y={reference.value}
                stroke={TOKENS.muted}
                strokeDasharray="4 4"
                label={{ value: reference.label, position: "right", fontSize: 11, fill: TOKENS.muted }}
              />
            )}
            {visible.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? "5 3" : undefined}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            <Legend wrapperStyle={{ display: "none" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {compareRecords && compareRecords.length > 0 && !splitBy && (
        <p className="mt-2 text-xs text-slate-500">
          Solid lines show the selected period, dashed lines the comparison period. Gaps mean the
          metric was not reported, not that it was zero.
        </p>
      )}
    </Card>
  );
}
