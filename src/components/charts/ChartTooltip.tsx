"use client";

import { KpiId, formatKpi } from "@/lib/kpi";

interface Entry {
  name?: string;
  value?: number | null;
  color?: string;
  dataKey?: string | number;
}

/**
 * Tooltip that formats every series with its own KPI unit and prints "N/A"
 * for a missing value rather than showing it as zero.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  currency = "USD",
  metricFor,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  currency?: string;
  metricFor: (dataKey: string) => KpiId;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((entry) => entry.value !== undefined);
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">
        {labelFormatter ? labelFormatter(String(label)) : String(label)}
      </p>
      <ul className="space-y-0.5">
        {visible.map((entry, index) => {
          const key = String(entry.dataKey ?? entry.name ?? index);
          return (
            <li key={key + index} className="flex items-center justify-between gap-4">
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
                  : formatKpi(metricFor(key), entry.value, currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
