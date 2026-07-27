"use client";

import clsx from "clsx";
import { CANONICAL_FIELDS } from "@/lib/csv/fields";
import { ColumnPlan, FieldCategory, UploadedFile } from "@/lib/types";
import { Badge } from "../ui/Badge";

const CATEGORY_ORDER: FieldCategory[] = [
  "dimension",
  "engagement",
  "retention",
  "monetization",
  "stability",
  "progression",
];

const CATEGORY_LABELS: Record<FieldCategory, string> = {
  dimension: "Dimensions",
  engagement: "Engagement",
  retention: "Retention",
  monetization: "Monetization",
  stability: "Stability",
  progression: "Progression",
};

function confidenceTone(confidence: number, mapped: boolean) {
  if (!mapped) return { tone: "neutral" as const, label: "Unmapped" };
  if (confidence >= 90) return { tone: "positive" as const, label: "High confidence" };
  if (confidence >= 70) return { tone: "primary" as const, label: "Good match" };
  if (confidence > 0) return { tone: "warning" as const, label: "Needs review" };
  return { tone: "neutral" as const, label: "Set manually" };
}

/**
 * Column-mapping table. Nothing is imported from a column the user has not
 * either mapped or explicitly ignored, so an uncertain guess is never silent.
 */
export function ColumnMapper({
  file,
  onChange,
}: {
  file: UploadedFile;
  onChange: (column: string, patch: Partial<ColumnPlan>) => void;
}) {
  const plan = file.plan ?? [];
  const unresolved = plan.filter((p) => !p.targetField && !p.ignored);

  return (
    <div>
      {unresolved.length > 0 && (
        <p
          role="note"
          className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20"
        >
          {unresolved.length} column(s) still need a decision. Map each one to a field or mark it as
          ignored — nothing is imported from an undecided column.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Map each column in {file.name} to a dashboard field
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-3 py-2 font-medium">Source column</th>
              <th scope="col" className="px-3 py-2 font-medium">Sample values</th>
              <th scope="col" className="px-3 py-2 font-medium">Type</th>
              <th scope="col" className="px-3 py-2 font-medium">Maps to</th>
              <th scope="col" className="px-3 py-2 font-medium">Confidence</th>
              <th scope="col" className="px-3 py-2 font-medium">Ignore</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((column) => {
              const badge = confidenceTone(column.confidence, Boolean(column.targetField));
              return (
                <tr
                  key={column.sourceColumn}
                  className={clsx(
                    "border-b border-slate-100 last:border-0",
                    column.ignored && "bg-slate-50/70 text-slate-400"
                  )}
                >
                  <th scope="row" className="px-3 py-2 text-left font-medium text-slate-800">
                    {column.sourceColumn}
                    {column.build && (
                      <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                        build {column.build}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {column.sampleValues.length > 0 ? column.sampleValues.join(", ") : "All blank"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {column.dataType}
                    {column.fractionRate && (
                      <span className="ml-1 text-[11px] text-slate-400">(0–1 scale)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <label className="sr-only" htmlFor={`map-${file.id}-${column.sourceColumn}`}>
                      Field for {column.sourceColumn}
                    </label>
                    <select
                      id={`map-${file.id}-${column.sourceColumn}`}
                      value={column.targetField ?? ""}
                      disabled={column.ignored}
                      onChange={(e) =>
                        onChange(column.sourceColumn, {
                          targetField: e.target.value || null,
                          confidence: e.target.value ? 100 : 0,
                        })
                      }
                      className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                    >
                      <option value="">Not mapped</option>
                      {CATEGORY_ORDER.map((category) => (
                        <optgroup key={category} label={CATEGORY_LABELS[category]}>
                          {CANONICAL_FIELDS.filter((f) => f.category === category).map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={column.ignored}
                        onChange={(e) => onChange(column.sourceColumn, { ignored: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                      />
                      Ignore
                      <span className="sr-only"> column {column.sourceColumn}</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
