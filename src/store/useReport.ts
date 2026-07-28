"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { KpiRecord, UploadedFile, ValidationIssue } from "@/lib/types";
import { decodeBuffer, hashContent } from "@/lib/csv/decode";
import { buildColumnPlan, detectReport, parseTable } from "@/lib/csv/parse";
import { transform } from "@/lib/csv/transform";
import { deduplicateAudience, mergeRecords } from "@/lib/merge";
import { validateDatabase } from "@/lib/validation";
import { dataDateRange } from "@/lib/select";

/** Real exports shipped in `public/samples` so the flow can be tried instantly. */
export const SAMPLE_FILES = [
  "dau-overall.csv",
  "overall-retention-d1-d7.csv",
  "playtime-in-seconds-per-user-overall.csv",
  "admob-report.csv",
];

function lastSevenDays(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

interface ReportState {
  phase: "upload" | "report";
  files: UploadedFile[];
  isProcessing: boolean;
  /** The app the report is about. Files covering other apps are left out. */
  game: string;
  records: KpiRecord[];
  issues: ValidationIssue[];

  addFiles: (files: File[]) => Promise<void>;
  loadSampleFiles: () => Promise<void>;
  removeFile: (id: string) => void;
  setPeriod: (fileId: string, period: { start: string; end: string }) => void;
  setGame: (game: string) => void;
  generate: () => void;
  reset: () => void;
}

/** Games named inside the staged files (an AdMob export names one app per row). */
export function detectedGames(files: UploadedFile[]): string[] {
  const set = new Set<string>();
  for (const file of files) {
    const table = file.parsedTable;
    const plan = file.plan;
    if (!table || !plan) continue;
    const gameColumn = plan.findIndex((p) => p.targetField === "game" && !p.ignored);
    if (gameColumn === -1) continue;
    table.rows.forEach((row) => {
      const value = (row[gameColumn] ?? "").trim();
      if (value) set.add(value);
    });
  }
  return Array.from(set).sort();
}

export const useReport = create<ReportState>()((set, get) => ({
  phase: "upload",
  files: [],
  isProcessing: false,
  game: "",
  records: [],
  issues: [],

  addFiles: async (fileList) => {
    set({ isProcessing: true });
    const staged: UploadedFile[] = [];

    for (const file of fileList) {
      const id = uuid();
      try {
        const buffer = await file.arrayBuffer();
        const { text, encoding } = decodeBuffer(buffer);
        const hash = hashContent(text);
        if (get().files.some((f) => f.contentHash === hash) || staged.some((f) => f.contentHash === hash)) {
          continue; // identical file already staged — double counting avoided silently
        }
        const table = parseTable(text, encoding);
        const detection = detectReport(table);
        const plan = buildColumnPlan(table, detection.reportKind);

        staged.push({
          id,
          name: file.name,
          size: file.size,
          contentHash: hash,
          source: detection.source,
          reportKind: detection.reportKind,
          status: "needs_review",
          currency: detection.currency,
          period: table.detectedPeriod,
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

    set((state) => {
      const files = [...state.files, ...staged];
      const games = detectedGames(files);
      return {
        files,
        isProcessing: false,
        // Keep an explicit choice; otherwise default to the first detected app.
        game: state.game || games[0] || "",
      };
    });
  },

  loadSampleFiles: async () => {
    set({ isProcessing: true });
    try {
      const fetched = await Promise.all(
        SAMPLE_FILES.map(async (name) => {
          const response = await fetch(`/samples/${name}`);
          if (!response.ok) throw new Error(`Could not load the sample file ${name}`);
          return new File([await response.blob()], name, { type: "text/csv" });
        })
      );
      set({ isProcessing: false });
      await get().addFiles(fetched);
    } catch {
      set({ isProcessing: false });
    }
  },

  removeFile: (id) => set((state) => ({ files: state.files.filter((f) => f.id !== id) })),

  setPeriod: (fileId, period) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, period, status: "needs_review" } : f
      ),
    })),

  setGame: (game) => set({ game }),

  generate: () => {
    const { files, game } = get();
    let all: KpiRecord[] = [];
    const fileIssues: ValidationIssue[] = [];
    const usable = files.filter((f) => f.parsedTable && f.plan && f.status !== "error");

    const runTransform = (file: UploadedFile, period?: { start: string; end: string }) => {
      const result = transform(file.parsedTable!, file.plan!, {
        uploadId: file.id,
        fileName: file.name,
        source: file.source,
        reportKind: file.reportKind,
        game: game || undefined,
        currency: file.currency,
        period,
      });
      all = all.concat(result.records);
      fileIssues.push(...result.issues);
    };

    // Dated files first, so a dateless report (an AdMob weekly export) can take
    // its period from the days the other files actually cover.
    const hasOwnDates = (file: UploadedFile) =>
      Boolean(file.period) ||
      Boolean(file.plan?.some((p) => p.targetField === "date" && !p.ignored));

    usable.filter(hasOwnDates).forEach((file) => runTransform(file, file.period));
    const datedRange = dataDateRange(all);

    usable
      .filter((file) => !hasOwnDates(file))
      .forEach((file) => {
        const period = datedRange ?? lastSevenDays();
        runTransform(file, period);
        fileIssues.push({
          id: `auto-period-${file.id}`,
          severity: "info",
          category: "Reporting period inferred",
          description: `${file.name} has no date column. Its figures were assigned to ${period.start} – ${period.end}, ${
            datedRange
              ? "the span covered by the other uploaded files"
              : "the last seven days, since no other file carried dates"
          }.`,
          resolution: "Export the report with a date column if the period should be different.",
          sourceFile: file.name,
        });
      });

    // The report is about one app only.
    const scoped = game ? all.filter((r) => r.game === game) : all;

    const deduped = deduplicateAudience(scoped);
    const merged = mergeRecords(deduped.records);
    const issues = [
      ...fileIssues,
      ...deduped.conflicts,
      ...merged.conflicts,
      ...validateDatabase(merged.records, files),
    ];

    set({ records: merged.records, issues, phase: "report" });
  },

  reset: () => set({ phase: "upload", files: [], records: [], issues: [], game: "" }),
}));
