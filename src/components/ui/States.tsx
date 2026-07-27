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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-lg text-sm text-slate-500">{description}</p>
      {children && <div className="mt-4 w-full max-w-2xl text-left">{children}</div>}
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
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-4">
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-1 text-sm text-red-700">{description}</p>
    </div>
  );
}

export function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-slate-900">No results for the selected filters</h3>
      <p className="mt-1 text-sm text-slate-500">
        No rows match the current filter and date-range combination.
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

export const MINIMUM_COLUMNS: { purpose: string; columns: string }[] = [
  { purpose: "Acquisition reporting", columns: "Date, Spend, Campaign, and at least one of Impressions, Clicks, or Installs" },
  { purpose: "CTR", columns: "Clicks, Impressions" },
  { purpose: "CPI", columns: "Spend, Installs" },
  { purpose: "ROAS", columns: "Spend, plus Revenue or an explicitly mapped conversion value" },
  { purpose: "Version comparison", columns: "App version, Date, and Users, Installs, Revenue or Retention" },
];

export function MinimumColumnsTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Minimum useful columns per reporting purpose</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="py-2 pr-4 font-medium">To calculate</th>
            <th scope="col" className="py-2 font-medium">You need at minimum</th>
          </tr>
        </thead>
        <tbody>
          {MINIMUM_COLUMNS.map((row) => (
            <tr key={row.purpose} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="py-2 pr-4 align-top font-medium text-slate-800">
                {row.purpose}
              </th>
              <td className="py-2 text-slate-600">{row.columns}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
