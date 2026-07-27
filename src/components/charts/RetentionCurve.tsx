"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiRecord } from "@/lib/types";
import { kpisFor } from "@/lib/kpi";
import { groupBy } from "@/lib/select";
import { Card } from "../ui/Card";
import { TOKENS, exportChartPng, seriesColor } from "./chartUtils";
import { formatPercent } from "@/lib/format";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Retention decay curve. A day with no matured cohort is left as a gap so a
 * young cohort never reads as a collapse to zero.
 */
export function RetentionCurve({
  id = "retention-curve",
  records,
  splitBy,
  title = "Retention curve",
  question = "How quickly do new players stop coming back?",
}: {
  id?: string;
  records: KpiRecord[];
  splitBy?: keyof KpiRecord;
  title?: string;
  question?: string;
}) {
  const { data, series } = useMemo(() => {
    const groups: [string, KpiRecord[]][] = splitBy
      ? Array.from(groupBy(records, splitBy).entries()).sort(([a], [b]) =>
          a.localeCompare(b, undefined, { numeric: true })
        )
      : [["Retention", records]];

    const seriesMeta = groups.map(([key], index) => ({
      key,
      color: seriesColor(index),
    }));

    const data = DAYS.map((day) => {
      const row: Record<string, number | null | string> = { day: `D${day}` };
      groups.forEach(([key, groupRecords]) => {
        const kpis = kpisFor(groupRecords);
        const value = kpis[`retentionD${day}` as keyof typeof kpis];
        row[key] = typeof value === "number" ? value : null;
      });
      return row;
    });

    return { data, series: seriesMeta };
  }, [records, splitBy]);

  const hasAny = data.some((row) => series.some((s) => row[s.key] !== null));

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
      {!hasAny ? (
        <p className="py-10 text-center text-sm text-slate-500">
          No retention data is available for the current selection.
        </p>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={TOKENS.grid} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatPercent(typeof value === "number" ? value : null),
                    String(name),
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
                />
                {series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.key}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.key}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Missing points mean the cohort has not reached that day yet. Retention is weighted by
            cohort size where the source provides one.
          </p>
        </>
      )}
    </Card>
  );
}
