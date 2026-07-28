"use client";

import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useData } from "@/store/useData";
import { formatDate, formatDateTime } from "@/lib/format";
import { exportRecordsCsv } from "@/lib/exportCsv";
import { addDays } from "@/lib/week";

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 28 days", days: 28 },
  { label: "Last 90 days", days: 90 },
];

export function Header() {
  const { hydrated, filters, fullRange, current, lastRefresh, facets } = useData();
  const setDateRange = useStore((s) => s.setDateRange);
  const setComparisonMode = useStore((s) => s.setComparisonMode);
  const comparisonMode = useStore((s) => s.comparisonMode);
  const setFilter = useStore((s) => s.setFilter);

  const applyPreset = (days: number) => {
    if (!fullRange) return;
    const start = addDays(fullRange.end, -(days - 1));
    setDateRange({ start: start < fullRange.start ? fullRange.start : start, end: fullRange.end });
  };

  const selectedGame = filters.games[0] ?? "";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 19V11M10 19V5M16 19v-8M21 19H3" />
            </svg>
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">
              KPIvantra
            </h1>
            <p className="text-xs text-slate-500">
              KPI reporting, build comparison and historical trends
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="game-select">
            Game
          </label>
          <select
            id="game-select"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            value={selectedGame}
            onChange={(e) => {
              setFilter("games", e.target.value ? [e.target.value] : []);
            }}
          >
            <option value="">All games</option>
            {facets.games.map((game) => (
              <option key={game} value={game}>
                {game}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="range-select">
            Date range
          </label>
          <select
            id="range-select"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            defaultValue={28}
            onChange={(e) => applyPreset(Number(e.target.value))}
          >
            {PRESETS.map((preset) => (
              <option key={preset.days} value={preset.days}>
                {preset.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="compare-select">
            Comparison period
          </label>
          <select
            id="compare-select"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            value={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.value as typeof comparisonMode)}
          >
            <option value="previous_period">vs previous period</option>
            <option value="last_month">vs same period last month</option>
            <option value="none">No comparison</option>
          </select>

          <Link
            href="/import"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Upload data
          </Link>

          <button
            type="button"
            onClick={() => exportRecordsCsv(current, "kpi-export.csv")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-2 text-xs text-slate-500 sm:px-6">
        <span>
          Period{" "}
          <span className="font-medium text-slate-700">
            {filters.dateRange
              ? `${formatDate(filters.dateRange.start)} – ${formatDate(filters.dateRange.end)}`
              : "All data"}
          </span>
        </span>
        {filters.compareRange && (
          <span>
            Compared with{" "}
            <span className="font-medium text-slate-700">
              {formatDate(filters.compareRange.start)} – {formatDate(filters.compareRange.end)}
            </span>
          </span>
        )}
        <span suppressHydrationWarning>
          Last import{" "}
          <span className="font-medium text-slate-700">
            {hydrated && new Date(lastRefresh).getTime() > 0
              ? formatDateTime(lastRefresh)
              : "No files imported yet"}
          </span>
        </span>
      </div>
    </header>
  );
}

export { addDays };
