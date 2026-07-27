"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useData } from "@/store/useData";
import { Dropzone } from "@/components/import/Dropzone";
import { ColumnMapper } from "@/components/import/ColumnMapper";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ErrorState, ExpectedFilesTable, LoadingState } from "@/components/ui/States";
import {
  ColumnPlan,
  ImportStatus,
  REPORT_KIND_LABELS,
  SOURCE_LABELS,
  SourceId,
  UploadedFile,
} from "@/lib/types";
import { formatDate, formatFileSize, formatNumber } from "@/lib/format";
import { distinctValues } from "@/lib/select";

const STATUS_META: Record<ImportStatus, { tone: "positive" | "negative" | "warning" | "neutral" | "primary"; label: string; description: string }> = {
  parsing: { tone: "neutral", label: "Parsing", description: "Reading the file." },
  needs_review: {
    tone: "primary",
    label: "Ready to review",
    description: "Check the detected settings and column mapping, then import.",
  },
  needs_period: {
    tone: "warning",
    label: "Needs a reporting period",
    description: "This report has no date column. Set the period it covers before importing.",
  },
  imported: { tone: "positive", label: "Imported", description: "Stored in the historical database." },
  partial: {
    tone: "warning",
    label: "Partially imported",
    description: "Some rows could not be imported. See the issues below.",
  },
  duplicate: {
    tone: "negative",
    label: "Duplicate",
    description: "An identical file is already in the database. Importing it would double count.",
  },
  error: { tone: "negative", label: "Error", description: "This file could not be imported." },
};

export default function ImportPage() {
  const files = useStore((s) => s.files);
  const isProcessing = useStore((s) => s.isProcessing);
  const addFiles = useStore((s) => s.addFiles);
  const loadSampleFiles = useStore((s) => s.loadSampleFiles);
  const updateFile = useStore((s) => s.updateFile);
  const updateColumn = useStore((s) => s.updateColumn);
  const commitFile = useStore((s) => s.commitFile);
  const removeFile = useStore((s) => s.removeFile);
  const saveTemplate = useStore((s) => s.saveTemplate);
  const applyTemplate = useStore((s) => s.applyTemplate);
  const clearDatabase = useStore((s) => s.clearDatabase);
  const templates = useStore((s) => s.templates);
  const { hydrated, allRecords, isDemo } = useData();

  const knownGames = useMemo(() => distinctValues(allRecords, "game"), [allRecords]);
  const pending = files.filter((f) => f.status !== "imported");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Data import</h2>
          <p className="text-sm text-slate-500">
            Upload weekly exports. Each import is validated, mapped and stored as a permanent record.
          </p>
        </div>
        {hydrated && files.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "This permanently deletes every imported file and record from the local database. Continue?"
                )
              ) {
                clearDatabase();
              }
            }}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Clear database
          </button>
        )}
      </div>

      <Dropzone onFiles={addFiles} busy={isProcessing} />

      <p className="text-center text-xs text-slate-500">
        No export handy?{" "}
        <button
          type="button"
          onClick={loadSampleFiles}
          disabled={isProcessing}
          className="font-medium text-blue-700 underline hover:text-blue-800 disabled:opacity-50"
        >
          Load the bundled sample files
        </button>{" "}
        — a GameAnalytics DAU, retention and playtime export plus a UTF-16 tab-separated AdMob
        report.
      </p>

      {isProcessing && <LoadingState label="Decoding and parsing files…" />}

      {hydrated && isDemo && files.length === 0 && (
        <Card title="What to upload" question="Which files unlock which KPIs?">
          <p className="mb-3 text-sm text-slate-600">
            The dashboard is currently showing demo data. It is replaced automatically as soon as the
            first real file is imported.
          </p>
          <ExpectedFilesTable />
        </Card>
      )}

      {hydrated && pending.length > 0 && (
        <section aria-label="Files awaiting import" className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Files awaiting import ({pending.length})
          </h3>
          {pending.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              knownGames={knownGames}
              hasTemplate={Boolean(templates[file.source])}
              onUpdate={(patch) => updateFile(file.id, patch)}
              onColumnChange={(column, patch) => updateColumn(file.id, column, patch)}
              onCommit={() => commitFile(file.id)}
              onRemove={() => removeFile(file.id)}
              onSaveTemplate={() => file.plan && saveTemplate(file.source, file.plan)}
              onApplyTemplate={() => applyTemplate(file.id, file.source)}
            />
          ))}
        </section>
      )}

      {hydrated && files.some((f) => f.status === "imported") && (
        <Card title="Imported files" question="What is already in the database?">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <caption className="sr-only">Files stored in the historical database</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-medium">File</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Game</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Period</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Records</th>
                  <th scope="col" className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files
                  .filter((f) => f.status === "imported")
                  .map((file) => (
                    <tr key={file.id} className="border-b border-slate-100 last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-800">
                        {file.name}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {formatFileSize(file.size)}
                        </span>
                      </th>
                      <td className="py-2 pr-3 text-slate-600">
                        {SOURCE_LABELS[file.source as SourceId] ?? file.source}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{file.game ?? "—"}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {file.period
                          ? `${formatDate(file.period.start)} – ${formatDate(file.period.end)}`
                          : "From file"}
                      </td>
                      <td className="tabular py-2 pr-3 text-right text-slate-600">
                        {formatNumber(file.importedRecordCount)}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove "${file.name}" and its ${file.importedRecordCount} records from the database?`
                              )
                            ) {
                              removeFile(file.id);
                            }
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            <Link href="/" className="font-medium text-blue-700 hover:underline">
              Open the dashboard
            </Link>{" "}
            to see the imported data.
          </p>
        </Card>
      )}
    </div>
  );
}

function FileCard({
  file,
  knownGames,
  hasTemplate,
  onUpdate,
  onColumnChange,
  onCommit,
  onRemove,
  onSaveTemplate,
  onApplyTemplate,
}: {
  file: UploadedFile;
  knownGames: string[];
  hasTemplate: boolean;
  onUpdate: (patch: Partial<UploadedFile>) => void;
  onColumnChange: (column: string, patch: Partial<ColumnPlan>) => void;
  onCommit: () => void;
  onRemove: () => void;
  onSaveTemplate: () => void;
  onApplyTemplate: () => void;
}) {
  const [showMapping, setShowMapping] = useState(file.status === "needs_review");
  const meta = STATUS_META[file.status];
  const table = file.parsedTable;

  const needsPeriod = !file.plan?.some((p) => p.targetField === "date" && !p.ignored) && !file.period;
  const unresolved = (file.plan ?? []).filter((p) => !p.targetField && !p.ignored).length;
  const canImport =
    file.status !== "duplicate" && file.status !== "error" && !needsPeriod && Boolean(file.game);

  return (
    <Card
      title={file.name}
      description={`${formatFileSize(file.size)} · ${REPORT_KIND_LABELS[file.reportKind]}${
        table ? ` · ${table.encoding}, ${table.delimiter === "\t" ? "tab" : `"${table.delimiter}"`} separated` : ""
      }`}
      actions={
        <div className="flex items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Remove
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">{meta.description}</p>

      {file.error && (
        <div className="mt-3">
          <ErrorState title="The file could not be read" description={file.error} />
        </div>
      )}

      {table && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <Detail label="Detected source" value={SOURCE_LABELS[file.source as SourceId] ?? file.source} />
            <Detail label="Rows found" value={formatNumber(table.rows.length)} />
            <Detail
              label="Header row"
              value={`Row ${table.headerRowIndex + 1}${table.titleRows.length ? ` (after ${table.titleRows.length} title row(s))` : ""}`}
            />
            <Detail label="Currency" value={file.currency ?? "Not stated"} />
            {table.dateRangeText && (
              <Detail label="Date range in file" value={table.dateRangeText} />
            )}
            {table.footerRows.length > 0 && (
              <Detail
                label="Total rows skipped"
                value={`${table.footerRows.length} summary row(s)`}
              />
            )}
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Game" required>
              <input
                list={`games-${file.id}`}
                value={file.game ?? ""}
                onChange={(e) => onUpdate({ game: e.target.value || undefined })}
                placeholder="Which game is this?"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <datalist id={`games-${file.id}`}>
                {knownGames.map((game) => (
                  <option key={game} value={game} />
                ))}
              </datalist>
            </Field>
            <Field label="Platform">
              <select
                value={file.platform ?? ""}
                onChange={(e) => onUpdate({ platform: e.target.value || undefined })}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Not specified</option>
                <option value="iOS">iOS</option>
                <option value="Android">Android</option>
              </select>
            </Field>
            <Field label="Country">
              <input
                value={file.country ?? ""}
                onChange={(e) => onUpdate({ country: e.target.value || undefined })}
                placeholder="All countries"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Build (if the file covers one)">
              <input
                value={file.build ?? ""}
                onChange={(e) => onUpdate({ build: e.target.value || undefined })}
                placeholder="From columns"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </Field>
          </div>

          {needsPeriod && (
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-3 ring-1 ring-inset ring-amber-600/20">
              <p className="text-sm font-medium text-amber-900">
                This report has no date column, so it needs a reporting period.
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                Period totals are divided evenly across the days in the range, so per-day KPIs such
                as ARPDAU and IMPDAU stay correct.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Field label="Period start">
                  <input
                    type="date"
                    value={file.period?.start ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        period: {
                          start: e.target.value,
                          end: file.period?.end ?? e.target.value,
                        },
                      })
                    }
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </Field>
                <Field label="Period end">
                  <input
                    type="date"
                    value={file.period?.end ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        period: {
                          start: file.period?.start ?? e.target.value,
                          end: e.target.value,
                        },
                      })
                    }
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowMapping((v) => !v)}
              aria-expanded={showMapping}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <span aria-hidden="true">{showMapping ? "▾" : "▸"}</span>
              Column mapping ({file.plan?.length ?? 0} columns
              {unresolved > 0 ? `, ${unresolved} undecided` : ""})
            </button>
            {showMapping && (
              <div className="mt-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onSaveTemplate}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Save as {SOURCE_LABELS[file.source as SourceId]} template
                  </button>
                  {hasTemplate && (
                    <button
                      type="button"
                      onClick={onApplyTemplate}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Apply saved template
                    </button>
                  )}
                </div>
                <ColumnMapper file={file} onChange={onColumnChange} />
              </div>
            )}
          </div>

          {file.issues.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {file.issues.slice(0, 6).map((issue) => (
                <li
                  key={issue.id}
                  className={`rounded-md px-3 py-2 text-xs ${
                    issue.severity === "error"
                      ? "bg-red-50 text-red-800"
                      : issue.severity === "warning"
                        ? "bg-amber-50 text-amber-900"
                        : "bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="font-semibold">{issue.category}:</span> {issue.description}{" "}
                  <span className="opacity-80">{issue.resolution}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canImport}
              onClick={onCommit}
              className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import into database
            </button>
            {!file.game && (
              <span className="text-xs text-amber-700">Assign a game before importing.</span>
            )}
            {file.status === "duplicate" && (
              <span className="text-xs text-red-700">
                This exact file is already in the database.
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      {required && <span className="text-red-600"> *</span>}
      <span className="mt-1 block font-normal">{children}</span>
    </label>
  );
}
