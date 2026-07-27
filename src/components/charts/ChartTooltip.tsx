"use client";

import { MetricFormat, formatByType } from "./chartUtils";

interface Payload {
  name?: string;
  value?: number | null;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  currency = "USD",
  formats,
  labelPrefix,
}: {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
  currency?: string;
  formats: Record<string, MetricFormat>;
  labelPrefix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">
        {labelPrefix}
        {label}
      </p>
      <ul className="space-y-0.5">
        {payload.map((entry, idx) => {
          const key = String(entry.dataKey ?? entry.name ?? idx);
          const format = formats[key] ?? "compact";
          return (
            <li key={key + idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: entry.color }}
                />
                {entry.name}
              </span>
              <span className="tabular font-medium text-slate-900">
                {entry.value === null || entry.value === undefined
                  ? "N/A"
                  : formatByType(entry.value, format, currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
