"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import {
  ColumnPlan,
  Filters,
  Granularity,
  KpiRecord,
  SavedView,
  SourceId,
  UploadedFile,
} from "@/lib/types";
import { decodeBuffer, hashContent } from "@/lib/csv/decode";
import { buildColumnPlan, detectReport, parseTable } from "@/lib/csv/parse";
import { transform } from "@/lib/csv/transform";
import { validateUpload } from "@/lib/validation";
import { generateDemoRecords } from "@/lib/demoData";
import { dataDateRange } from "@/lib/select";
import { previousRange } from "@/lib/week";

export const EMPTY_FILTERS: Filters = {
  games: [],
  platforms: [],
  countries: [],
  builds: [],
  sources: [],
  weeks: [],
  dateRange: null,
  compareRange: null,
};

export type ComparisonMode = "previous_period" | "last_month" | "none";

/** Real exports shipped in `public/samples` so the import flow can be tried immediately. */
export const SAMPLE_FILES = [
  "dau-overall.csv",
  "overall-retention-d1-d7.csv",
  "playtime-in-seconds-per-user-overall.csv",
  "admob-report.csv",
];

interface StoreState {
  /** Committed records — the historical database. */
  records: KpiRecord[];
  files: UploadedFile[];
  filters: Filters;
  comparisonMode: ComparisonMode;
  granularity: Granularity;
  savedViews: SavedView[];
  /** Reusable per-source column mappings. */
  templates: Record<string, ColumnPlan[]>;
  lastRefresh: string;
  isProcessing: boolean;

  addFiles: (files: File[]) => Promise<void>;
  loadSampleFiles: () => Promise<void>;
  updateFile: (id: string, patch: Partial<UploadedFile>) => void;
  updateColumn: (fileId: string, column: string, patch: Partial<ColumnPlan>) => void;
  commitFile: (fileId: string) => void;
  removeFile: (fileId: string) => void;
  saveTemplate: (source: SourceId, plan: ColumnPlan[]) => void;
  applyTemplate: (fileId: string, source: SourceId) => void;
  clearDatabase: () => void;

  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleFilter: (key: keyof Filters, value: string) => void;
  clearFilters: () => void;
  setDateRange: (range: Filters["dateRange"]) => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  setGranularity: (granularity: Granularity) => void;
  saveView: (name: string) => void;
  applyView: (id: string) => void;
  deleteView: (id: string) => void;
}

function computeCompare(
  range: Filters["dateRange"],
  mode: ComparisonMode
): Filters["compareRange"] {
  if (!range || mode === "none") return null;
  if (mode === "last_month") {
    return { start: shift(range.start, -28), end: shift(range.end, -28) };
  }
  return previousRange(range);
}

function shift(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      records: [],
      files: [],
      filters: EMPTY_FILTERS,
      comparisonMode: "previous_period",
      granularity: "daily",
      savedViews: [],
      templates: {},
      lastRefresh: new Date(0).toISOString(),
      isProcessing: false,

      addFiles: async (fileList) => {
        set({ isProcessing: true });
        const staged: UploadedFile[] = [];

        for (const file of fileList) {
          const id = uuid();
          try {
            const buffer = await file.arrayBuffer();
            const { text, encoding } = decodeBuffer(buffer);
            const table = parseTable(text, encoding);
            const detection = detectReport(table);
            const plan =
              get().templates[detection.source] &&
              get().templates[detection.source].length === table.headers.length
                ? get().templates[detection.source]
                : buildColumnPlan(table, detection.reportKind);

            const hash = hashContent(text);
            const isDuplicate = get().files.some((f) => f.contentHash === hash);

            // A report with no date column cannot be placed on the timeline
            // until the user states which period it covers.
            const hasDateColumn = plan.some((p) => p.targetField === "date" && !p.ignored);
            const period = table.detectedPeriod;

            staged.push({
              id,
              name: file.name,
              size: file.size,
              contentHash: hash,
              source: detection.source,
              reportKind: detection.reportKind,
              status: isDuplicate
                ? "duplicate"
                : !hasDateColumn && !period
                  ? "needs_period"
                  : "needs_review",
              currency: detection.currency,
              period,
              recordCount: table.rows.length,
              importedRecordCount: 0,
              skippedRecordCount: 0,
              parsedTable: table,
              plan,
              issues: [],
              uploadedAt: new Date().toISOString(),
            });
          } catch (error) {
            staged.push({
              id,
              name: file.name,
              size: file.size,
              contentHash: "",
              source: "generic",
              reportKind: "unknown",
              status: "error",
              recordCount: 0,
              importedRecordCount: 0,
              skippedRecordCount: 0,
              issues: [],
              uploadedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : "The file could not be read.",
            });
          }
        }

        set((state) => ({ files: [...state.files, ...staged], isProcessing: false }));
      },

      loadSampleFiles: async () => {
        set({ isProcessing: true });
        try {
          const fetched = await Promise.all(
            SAMPLE_FILES.map(async (name) => {
              const response = await fetch(`/samples/${name}`);
              if (!response.ok) throw new Error(`Could not load the sample file ${name}`);
              const blob = await response.blob();
              return new File([blob], name, { type: "text/csv" });
            })
          );
          set({ isProcessing: false });
          await get().addFiles(fetched);
        } catch {
          set({ isProcessing: false });
        }
      },

      updateFile: (id, patch) =>
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),

      updateColumn: (fileId, column, patch) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  plan: (f.plan ?? []).map((p) =>
                    p.sourceColumn === column ? { ...p, ...patch } : p
                  ),
                }
              : f
          ),
        })),

      commitFile: (fileId) => {
        const state = get();
        const file = state.files.find((f) => f.id === fileId);
        if (!file?.parsedTable || !file.plan) return;

        const { records, issues, skipped } = transform(file.parsedTable, file.plan, {
          uploadId: file.id,
          fileName: file.name,
          source: file.source,
          reportKind: file.reportKind,
          game: file.game,
          platform: file.platform,
          country: file.country,
          build: file.build,
          currency: file.currency,
          period: file.period,
        });

        const validation = validateUpload(
          { ...file, importedRecordCount: records.length },
          records,
          state.files
        );
        const allIssues = [...issues, ...validation];
        const blocking = allIssues.some((i) => i.severity === "error" && i.category !== "Invalid date");

        if (blocking) {
          set({
            files: state.files.map((f) =>
              f.id === fileId ? { ...f, status: "error", issues: allIssues } : f
            ),
          });
          return;
        }

        const status = skipped > 0 ? "partial" : "imported";
        const nextRecords = [
          ...state.records.filter((r) => r.uploadId !== fileId),
          ...records,
        ];

        set({
          records: nextRecords,
          files: state.files.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status,
                  issues: allIssues,
                  importedRecordCount: records.length,
                  skippedRecordCount: skipped,
                }
              : f
          ),
          lastRefresh: new Date().toISOString(),
        });

        // Point the dashboard at the data that was just imported.
        const range = dataDateRange(nextRecords);
        if (range) {
          set((s) => ({
            filters: {
              ...s.filters,
              dateRange: range,
              compareRange: computeCompare(range, s.comparisonMode),
            },
          }));
        }
      },

      removeFile: (fileId) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== fileId),
          records: state.records.filter((r) => r.uploadId !== fileId),
        })),

      saveTemplate: (source, plan) =>
        set((state) => ({ templates: { ...state.templates, [source]: plan } })),

      applyTemplate: (fileId, source) => {
        const template = get().templates[source];
        if (!template) return;
        set((state) => ({
          files: state.files.map((f) => {
            if (f.id !== fileId || !f.parsedTable) return f;
            // Match by column name so a template survives reordered exports.
            const plan = (f.plan ?? []).map((column) => {
              const saved = template.find((t) => t.sourceColumn === column.sourceColumn);
              return saved ? { ...column, targetField: saved.targetField, ignored: saved.ignored, confidence: 100 } : column;
            });
            return { ...f, plan };
          }),
        }));
      },

      clearDatabase: () =>
        set({ records: [], files: [], filters: EMPTY_FILTERS }),

      setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),

      toggleFilter: (key, value) =>
        set((state) => {
          const current = state.filters[key];
          if (!Array.isArray(current)) return state;
          const list = current as string[];
          return {
            filters: {
              ...state.filters,
              [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
            },
          } as Partial<StoreState>;
        }),

      clearFilters: () =>
        set((state) => ({
          filters: {
            ...EMPTY_FILTERS,
            dateRange: state.filters.dateRange,
            compareRange: state.filters.compareRange,
          },
        })),

      setDateRange: (range) =>
        set((state) => ({
          filters: {
            ...state.filters,
            dateRange: range,
            compareRange: computeCompare(range, state.comparisonMode),
          },
        })),

      setComparisonMode: (mode) =>
        set((state) => ({
          comparisonMode: mode,
          filters: {
            ...state.filters,
            compareRange: computeCompare(state.filters.dateRange, mode),
          },
        })),

      setGranularity: (granularity) => set({ granularity }),

      saveView: (name) =>
        set((state) => ({
          savedViews: [...state.savedViews, { id: uuid(), name, filters: state.filters }],
        })),

      applyView: (id) =>
        set((state) => {
          const view = state.savedViews.find((v) => v.id === id);
          return view ? { filters: view.filters } : state;
        }),

      deleteView: (id) =>
        set((state) => ({ savedViews: state.savedViews.filter((v) => v.id !== id) })),
    }),
    {
      name: "game-kpi-database",
      storage: createJSONStorage(() => localStorage),
      // Parsed tables are large and re-derivable; only the database is persisted.
      partialize: (state) => ({
        records: state.records,
        files: state.files.map((f) => ({ ...f, parsedTable: undefined })),
        filters: state.filters,
        comparisonMode: state.comparisonMode,
        granularity: state.granularity,
        savedViews: state.savedViews,
        templates: state.templates,
        lastRefresh: state.lastRefresh,
      }),
      version: 1,
    }
  )
);

let demoCache: KpiRecord[] | null = null;
export function demoRecords(): KpiRecord[] {
  if (!demoCache) demoCache = generateDemoRecords();
  return demoCache;
}
