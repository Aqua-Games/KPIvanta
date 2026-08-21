"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { KpiRecord, UploadedFile, ValidationIssue } from "@/lib/types";
import { decodeBuffer, hashContent } from "@/lib/csv/decode";
import { buildColumnPlan, detectReport, parseTable } from "@/lib/csv/parse";
import { transform } from "@/lib/csv/transform";
import { deduplicateAudience, mergeRecords } from "@/lib/merge";
import { parseDate } from "@/lib/csv/values";
import { validateDatabase } from "@/lib/validation";
import { dataDateRange } from "@/lib/select";
import { DEFAULT_WEEK_START, isoWeekKey, setWeekStart, WeekStart } from "@/lib/week";
import { api, BASE_PATH, Project, ProjectData } from "@/lib/api";

export const SAMPLE_FILES = [
  "dau-overall.csv",
  "overall-retention-d1-d7.csv",
  "playtime-in-seconds-per-user-overall.csv",
  "admob-report.csv",
];

type StoredFile = ProjectData["files"][number];

interface WorkspaceState {
  projectId: string | null;
  project: Project | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  /** Committed, persisted state. */
  records: KpiRecord[];
  files: StoredFile[];
  issues: ValidationIssue[];
  weeklySpend: Record<string, number>;

  /** Files staged in the browser, not yet turned into records. */
  staged: UploadedFile[];
  isProcessing: boolean;

  load: (projectId: string) => Promise<void>;
  addFiles: (files: File[]) => Promise<void>;
  loadSampleFiles: () => Promise<void>;
  removeStaged: (id: string) => void;
  setStagedPeriod: (id: string, period: { start: string; end: string } | undefined) => void;
  processStaged: () => Promise<void>;
  setWeeklySpend: (week: string, value: number | null) => Promise<void>;
  setProjectWeekStart: (start: WeekStart) => Promise<void>;
  clearData: () => Promise<void>;
}

function lastSevenDays(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * Reporting weeks covered by the dated staged sheets (and anything already
 * imported). A dateless sheet must be pinned to one of these: two weekly AdMob
 * exports uploaded together would otherwise both smear across the whole span,
 * every day would carry the first file's figures, and both weeks would show
 * identical, halved revenue.
 */
export function stagedDatedWeeks(staged: UploadedFile[], records: KpiRecord[]): string[] {
  const weeks = new Set<string>();
  for (const record of records) if (record.week && record.date) weeks.add(isoWeekKey(record.date));
  for (const file of staged) {
    const { parsedTable: table, plan } = file;
    if (!table || !plan) continue;
    const dateColumn = plan.findIndex((p) => p.targetField === "date" && !p.ignored);
    if (dateColumn === -1) continue;
    for (const row of table.rows) {
      const date = parseDate(row[dateColumn] ?? "");
      if (date) weeks.add(isoWeekKey(date));
    }
  }
  return Array.from(weeks).sort();
}

/** Staged files that carry no date column and so need a period assigned. */
export function datelessStaged(staged: UploadedFile[]): UploadedFile[] {
  return staged.filter(
    (f) =>
      f.status !== "error" &&
      f.plan !== undefined &&
      !f.plan.some((p) => p.targetField === "date" && !p.ignored)
  );
}

/** Games named inside staged files, so a multi-app export can be narrowed down. */
export function stagedGames(files: UploadedFile[]): string[] {
  const set = new Set<string>();
  for (const file of files) {
    const { parsedTable: table, plan } = file;
    if (!table || !plan) continue;
    const column = plan.findIndex((p) => p.targetField === "game" && !p.ignored);
    if (column === -1) continue;
    table.rows.forEach((row) => {
      const value = (row[column] ?? "").trim();
      if (value) set.add(value);
    });
  }
  return Array.from(set).sort();
}

/**
 * Manual weekly spend becomes per-day spend records, so it aggregates correctly
 * under any date range instead of being a figure bolted on at the end.
 */
export function applyWeeklySpend(
  records: KpiRecord[],
  weeklySpend: Record<string, number>
): KpiRecord[] {
  const entries = Object.entries(weeklySpend).filter(([, value]) => value > 0);
  if (entries.length === 0) return records;

  const daysPerWeek = new Map<string, string[]>();
  for (const record of records) {
    if (!record.date) continue;
    const week = record.week ?? isoWeekKey(record.date);
    const days = daysPerWeek.get(week) ?? [];
    if (!days.includes(record.date)) days.push(record.date);
    daysPerWeek.set(week, days);
  }

  const spendRecords: KpiRecord[] = [];
  for (const [week, amount] of entries) {
    const days = daysPerWeek.get(week);
    if (!days || days.length === 0) continue;
    const perDay = amount / days.length;
    for (const date of days) {
      spendRecords.push({
        id: `spend-${week}-${date}`,
        uploadId: "manual-spend",
        source: "generic",
        date,
        week,
        spend: perDay,
      });
    }
  }
  return [...records, ...spendRecords];
}

/** Week keys are derived from the date, never trusted from storage. */
function restampWeeks(records: KpiRecord[]): KpiRecord[] {
  return records.map((r) => (r.date ? { ...r, week: isoWeekKey(r.date) } : r));
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  projectId: null,
  project: null,
  loading: false,
  saving: false,
  error: null,
  records: [],
  files: [],
  issues: [],
  weeklySpend: {},
  staged: [],
  isProcessing: false,

  load: async (projectId) => {
    set({ loading: true, error: null, projectId });
    try {
      const [project, data] = await Promise.all([
        api.getProject(projectId),
        api.getProjectData(projectId),
      ]);
      // The week convention must be in force before anything reads a week key.
      setWeekStart(project.weekStart ?? DEFAULT_WEEK_START);
      set({
        project,
        // Week keys are stamped at import time, so re-derive them from the date.
        // That keeps records correct when the convention changes and migrates
        // anything imported under the old one.
        records: restampWeeks(data.records),
        files: data.files,
        issues: data.issues,
        weeklySpend: data.weeklySpend ?? {},
        staged: [],
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Could not load the project." });
    }
  },

  addFiles: async (fileList) => {
    set({ isProcessing: true });
    const staged: UploadedFile[] = [];
    const known = new Set(get().files.map((f) => f.id));

    for (const file of fileList) {
      const id = uuid();
      try {
        const buffer = await file.arrayBuffer();
        const { text, encoding } = decodeBuffer(buffer);
        const hash = hashContent(text);
        // A file already imported into this project, or already staged, is skipped.
        if (known.has(hash) || get().staged.some((f) => f.contentHash === hash)) continue;

        const table = parseTable(text, encoding);
        const detection = detectReport(table);
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
          plan: buildColumnPlan(table, detection.reportKind),
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

    set((state) => ({ staged: [...state.staged, ...staged], isProcessing: false }));
  },

  loadSampleFiles: async () => {
    set({ isProcessing: true });
    try {
      const fetched = await Promise.all(
        SAMPLE_FILES.map(async (name) => {
          const response = await fetch(`${BASE_PATH}/samples/${name}`);
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

  removeStaged: (id) => set((state) => ({ staged: state.staged.filter((f) => f.id !== id) })),

  setStagedPeriod: (id, period) =>
    set((state) => ({
      staged: state.staged.map((f) => (f.id === id ? { ...f, period } : f)),
    })),

  processStaged: async () => {
    const { staged, records, files, issues, projectId, project } = get();
    if (!projectId) return;
    set({ saving: true });

    let fresh: KpiRecord[] = [];
    const newIssues: ValidationIssue[] = [];
    const usable = staged.filter((f) => f.parsedTable && f.plan && f.status !== "error");

    const run = (file: UploadedFile, period?: { start: string; end: string }) => {
      const result = transform(file.parsedTable!, file.plan!, {
        uploadId: file.contentHash || file.id,
        fileName: file.name,
        source: file.source,
        reportKind: file.reportKind,
        // Files that name their own app keep that name; the rest inherit the
        // project's, and everything is normalised to one identity below.
        game: project?.appName ?? project?.name,
        currency: file.currency ?? project?.currency,
        period,
        spreadAcrossPeriod: period !== undefined,
      });
      fresh = fresh.concat(result.records);
      newIssues.push(...result.issues);
    };

    // Only a real date column counts as dated. A file that merely states a
    // reporting period is spread across it, otherwise every one of its rows
    // would pile onto a single day and collide with the daily sheets.
    const hasDateColumn = (file: UploadedFile) =>
      Boolean(file.plan?.some((p) => p.targetField === "date" && !p.ignored));

    usable.filter(hasDateColumn).forEach((file) => run(file));
    const inferred = dataDateRange(fresh) ?? dataDateRange(records);

    usable
      .filter((file) => !hasDateColumn(file))
      .forEach((file) => {
        const period = file.period ?? inferred ?? lastSevenDays();
        run(file, period);
        newIssues.push({
          id: `auto-period-${file.id}`,
          severity: "info",
          category: "Reporting period inferred",
          description: `${file.name} has no date column, so its figures were assigned to ${period.start} – ${period.end}.`,
          resolution: "Export with a date column if a different period is intended.",
          sourceFile: file.name,
        });
      });

    // Sheets name their app differently from the project ("Arrows: Brain Puzzle
    // Escape" vs a project called "Arrow Escaape"). Dropping non-matching rows
    // would silently discard the revenue, so bind instead: an export naming a
    // single app is taken to be this project's, and only a genuinely multi-app
    // export is filtered.
    const bound = new Set(
      [project?.appName, project?.name].filter(Boolean).map((n) => n!.toLowerCase())
    );
    const namesInSheets = Array.from(new Set(fresh.map((r) => r.game).filter(Boolean) as string[]));
    const unmatched = namesInSheets.filter((n) => !bound.has(n.toLowerCase()));

    let adopted: string | undefined;
    if (unmatched.length > 0 && namesInSheets.length === unmatched.length + bound.size) {
      // Nothing matched by name. One app in the sheets means no ambiguity.
      if (unmatched.length === 1) {
        adopted = unmatched[0];
        bound.add(adopted.toLowerCase());
        newIssues.push({
          id: `app-bound-${Date.now()}`,
          severity: "info",
          category: "App matched",
          description: `The sheets name the app "${adopted}", which does not match the project name "${project?.name}". It was treated as this project's app.`,
          resolution: "Rename the project if that is wrong — nothing was discarded.",
          sourceFile: "Upload",
        });
      } else {
        newIssues.push({
          id: `app-ambiguous-${Date.now()}`,
          severity: "warning",
          category: "Several apps in one sheet",
          description: `The sheets cover ${unmatched.length} apps (${unmatched.join(", ")}) and none matches the project name "${project?.name}". Their rows were left out.`,
          resolution: "Name the project after the app you want, or upload a sheet covering only that app.",
          sourceFile: "Upload",
        });
      }
    }

    const scoped = fresh
      .filter((r) => !r.game || bound.has(r.game.toLowerCase()))
      // One project is one game, so every row carries the same identity and
      // complementary sheets merge onto the same day.
      .map((r) => (r.game ? { ...r, game: project?.name ?? r.game } : r));

    if (adopted && projectId) {
      await api.updateProject(projectId, { appName: adopted });
    }

    const combined = [...records, ...scoped];
    const deduped = deduplicateAudience(combined);
    const merged = mergeRecords(deduped.records);

    const storedFiles: StoredFile[] = [
      ...files,
      ...usable.map((f) => ({
        id: f.contentHash || f.id,
        name: f.name,
        size: f.size,
        source: f.source,
        reportKind: f.reportKind,
        uploadedAt: f.uploadedAt,
        recordCount: f.recordCount,
      })),
    ];

    const allIssues = [
      ...issues.filter((i) => i.category === "Reporting period inferred"),
      ...newIssues,
      ...deduped.conflicts,
      ...merged.conflicts,
      ...validateDatabase(merged.records, []),
    ];

    try {
      await api.saveProjectData(projectId, {
        records: merged.records,
        files: storedFiles,
        issues: allIssues,
        weeklySpend: get().weeklySpend,
      });
      set({
        records: merged.records,
        files: storedFiles,
        issues: allIssues,
        staged: [],
        saving: false,
      });
    } catch (e) {
      set({ saving: false, error: e instanceof Error ? e.message : "Could not save the project." });
    }
  },

  setWeeklySpend: async (week, value) => {
    const { projectId, records, files, issues, weeklySpend } = get();
    if (!projectId) return;
    const next = { ...weeklySpend };
    if (value === null || Number.isNaN(value)) delete next[week];
    else next[week] = value;
    set({ weeklySpend: next, saving: true });
    try {
      await api.saveProjectData(projectId, { records, files, issues, weeklySpend: next });
    } finally {
      set({ saving: false });
    }
  },

  setProjectWeekStart: async (start: WeekStart) => {
    const { projectId, records, files, issues, weeklySpend, project } = get();
    if (!projectId || !project) return;
    set({ saving: true });
    try {
      setWeekStart(start);
      const restamped = restampWeeks(records);
      await api.updateProject(projectId, { weekStart: start });
      await api.saveProjectData(projectId, {
        records: restamped,
        files,
        issues,
        weeklySpend,
      });
      set({ project: { ...project, weekStart: start }, records: restamped, saving: false });
    } catch (e) {
      set({ saving: false, error: e instanceof Error ? e.message : "Could not save the setting." });
    }
  },

  clearData: async () => {
    const { projectId } = get();
    if (!projectId) return;
    set({ saving: true });
    await api.saveProjectData(projectId, { records: [], files: [], issues: [], weeklySpend: {} });
    set({ records: [], files: [], issues: [], weeklySpend: {}, staged: [], saving: false });
  },
}));
