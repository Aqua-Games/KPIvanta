import Link from "next/link";
import { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19V11M10 19V5M16 19v-8M21 19H3" />
        </svg>
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-xl text-sm text-slate-500">{description}</p>
      {children && <div className="mt-5 w-full max-w-3xl text-left">{children}</div>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function LoadingState({ label = "Processing…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-6 py-10 text-sm text-slate-600"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      {label}
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-1 text-sm text-red-700">{description}</p>
    </div>
  );
}

export function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-slate-900">No records match these filters</h3>
      <p className="mt-1 text-sm text-slate-500">
        Nothing in the database falls inside the selected filters and date range.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Clear all filters
      </button>
    </div>
  );
}

const EXPECTED_FILES: { file: string; columns: string; unlocks: string }[] = [
  {
    file: "Retention.csv",
    columns: "Date, Retention 1 … Retention 7",
    unlocks: "D1, D3 and D7 retention plus the retention curve",
  },
  {
    file: "DAU.csv",
    columns: "Date, one DAU column per build (DAU 2.0, DAU 1.9 …)",
    unlocks: "DAU trend, build adoption and every per-user KPI",
  },
  {
    file: "Playtime.csv",
    columns: "Date, one playtime column per build, in seconds per user",
    unlocks: "Playtime per user and session depth by build",
  },
  {
    file: "Ad Revenue.csv",
    columns: "App, Estimated earnings, Impressions, Requests, Matched requests, Clicks",
    unlocks: "ARPDAU, ARPDAU Ads, IMPDAU, eCPM, match and show rate",
  },
  {
    file: "Funnel.csv",
    columns: "Level starts and level completions",
    unlocks: "Level completion percentage",
  },
];

export function ExpectedFilesTable() {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Files to upload and the KPIs each one unlocks</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-3 py-2 font-medium">File</th>
            <th scope="col" className="px-3 py-2 font-medium">Minimum useful columns</th>
            <th scope="col" className="px-3 py-2 font-medium">Unlocks</th>
          </tr>
        </thead>
        <tbody>
          {EXPECTED_FILES.map((row) => (
            <tr key={row.file} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
              <th scope="row" className="px-3 py-2 align-top font-medium text-slate-800">
                {row.file}
              </th>
              <td className="px-3 py-2 align-top text-slate-600">{row.columns}</td>
              <td className="px-3 py-2 align-top text-slate-600">{row.unlocks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
