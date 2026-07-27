import { KpiRecord, UploadedFile, ValidationIssue } from "./types";
import { RETENTION_FIELDS } from "./kpi";
import { daysBetween } from "./week";

let seq = 0;
const nextId = () => `dq-${++seq}`;

/** Checks that run at import time, before a file is committed to the database. */
export function validateUpload(
  file: UploadedFile,
  records: KpiRecord[],
  existingFiles: UploadedFile[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const duplicate = existingFiles.find(
    (f) => f.id !== file.id && f.contentHash === file.contentHash
  );
  if (duplicate) {
    issues.push({
      id: nextId(),
      severity: "error",
      category: "Duplicate upload",
      description: `This file is byte-for-byte identical to "${duplicate.name}", uploaded on ${duplicate.uploadedAt.slice(0, 10)}.`,
      resolution: "Importing it again would double count every metric. Remove one of the two uploads.",
      sourceFile: file.name,
    });
  }

  // A game column inside the file names the app per row, so a file-level
  // assignment is only needed when no such column was mapped.
  const hasGameColumn = (file.plan ?? []).some((p) => p.targetField === "game" && !p.ignored);
  if (!file.game && !hasGameColumn && !records.some((r) => r.game)) {
    issues.push({
      id: nextId(),
      severity: "error",
      category: "Missing game",
      description: "No game is assigned to this file and no game column was found.",
      resolution: "Select the game on the import card before importing.",
      sourceFile: file.name,
    });
  }

  const unmapped = (file.plan ?? []).filter((p) => !p.targetField && !p.ignored);
  if (unmapped.length > 0) {
    issues.push({
      id: nextId(),
      severity: "warning",
      category: "Unmapped columns",
      description: `${unmapped.length} column(s) are neither mapped nor ignored: ${unmapped
        .map((p) => p.sourceColumn)
        .join(", ")}.`,
      resolution: "Map each column to a field or mark it as ignored so the decision is explicit.",
      sourceFile: file.name,
    });
  }

  const lowConfidence = (file.plan ?? []).filter(
    (p) => p.targetField && p.confidence > 0 && p.confidence < 70
  );
  if (lowConfidence.length > 0) {
    issues.push({
      id: nextId(),
      severity: "warning",
      category: "Uncertain mapping",
      description: `${lowConfidence.length} column(s) were matched with low confidence: ${lowConfidence
        .map((p) => `${p.sourceColumn} → ${p.targetField}`)
        .join(", ")}.`,
      resolution: "Confirm or correct these mappings before importing.",
      sourceFile: file.name,
    });
  }

  if (records.length === 0) {
    issues.push({
      id: nextId(),
      severity: "error",
      category: "No records produced",
      description: "The file parsed but produced no importable rows.",
      resolution: "Check the header row detection and the column mapping.",
      sourceFile: file.name,
    });
  }

  return issues;
}

/** Checks that run across everything already stored in the database. */
export function validateDatabase(
  records: KpiRecord[],
  files: UploadedFile[]
): ValidationIssue[] {
  seq = 0;
  const issues: ValidationIssue[] = [];
  const fileName = (uploadId: string) =>
    files.find((f) => f.id === uploadId)?.name ??
    (uploadId.startsWith("demo") ? "Demo dataset" : uploadId);

  const currencies = new Set(records.map((r) => r.currency).filter(Boolean) as string[]);
  if (currencies.size > 1) {
    issues.push({
      id: nextId(),
      severity: "warning",
      category: "Mixed currencies",
      description: `Revenue is reported in ${currencies.size} currencies (${Array.from(currencies).join(", ")}). Values in different currencies are never summed together.`,
      resolution: "Filter to a single currency, or supply an exchange rate to convert.",
      sourceFile: "Database",
    });
  }

  records.forEach((record) => {
    const file = fileName(record.uploadId);

    if (record.adRevenue !== undefined && record.adRevenue < 0) {
      issues.push({
        id: nextId(),
        severity: "error",
        category: "Negative revenue",
        description: `Ad revenue is negative (${record.adRevenue.toFixed(2)}) on ${record.date}.`,
        resolution: "Confirm whether this is a refund adjustment and exclude the row if not.",
        sourceFile: file,
      });
    }
    if (record.dau !== undefined && record.dau < 0) {
      issues.push({
        id: nextId(),
        severity: "error",
        category: "Negative users",
        description: `DAU is negative (${record.dau}) on ${record.date}.`,
        resolution: "Exclude the row or correct the source export.",
        sourceFile: file,
      });
    }
    if ((record.adRevenue ?? 0) > 0 && record.dau === 0) {
      issues.push({
        id: nextId(),
        severity: "warning",
        category: "Revenue with no users",
        description: `Revenue is reported with zero DAU on ${record.date}.`,
        resolution: "Check whether the user counts and the revenue come from the same reporting window.",
        sourceFile: file,
      });
    }
    if (
      record.adImpressions !== undefined &&
      record.matchedRequests !== undefined &&
      record.adImpressions > record.matchedRequests * 1.01
    ) {
      issues.push({
        id: nextId(),
        severity: "warning",
        category: "Impressions exceed matched requests",
        description: `${Math.round(record.adImpressions)} impressions against ${Math.round(record.matchedRequests)} matched requests on ${record.date}.`,
        resolution: "Verify the impression and request column mapping.",
        sourceFile: file,
      });
    }
    if (
      record.matchedRequests !== undefined &&
      record.adRequests !== undefined &&
      record.matchedRequests > record.adRequests * 1.01
    ) {
      issues.push({
        id: nextId(),
        severity: "warning",
        category: "Matched requests exceed requests",
        description: `${Math.round(record.matchedRequests)} matched against ${Math.round(record.adRequests)} requests on ${record.date}.`,
        resolution: "Check the mapping — these two columns may be swapped.",
        sourceFile: file,
      });
    }
    for (const field of RETENTION_FIELDS) {
      const value = record[field];
      if (value === undefined) continue;
      if (value < 0 || value > 100) {
        issues.push({
          id: nextId(),
          severity: "error",
          category: "Retention out of range",
          description: `${field} is ${value.toFixed(1)}% on ${record.date}, outside the valid 0–100% range.`,
          resolution: "The source may express retention on a different scale. Re-check the column mapping.",
          sourceFile: file,
        });
      }
    }
    // D1 below D7 is arithmetically impossible for the same cohort.
    if (
      record.retentionD1 !== undefined &&
      record.retentionD7 !== undefined &&
      record.retentionD7 > record.retentionD1
    ) {
      issues.push({
        id: nextId(),
        severity: "warning",
        category: "Retention curve inverted",
        description: `D7 retention (${record.retentionD7.toFixed(1)}%) is above D1 (${record.retentionD1.toFixed(1)}%) on ${record.date}.`,
        resolution: "Retention should decay. Check whether the day columns are in the expected order.",
        sourceFile: file,
      });
    }
  });

  // Version-format consistency: "2.0" and "v2.0.1" will not group together.
  const builds = Array.from(new Set(records.map((r) => r.build).filter(Boolean) as string[]));
  const shapes = new Set(
    builds.map((b) =>
      /^\d+\.\d+$/.test(b) ? "major.minor" : /^\d+\.\d+\.\d+$/.test(b) ? "semver" : "other"
    )
  );
  if (shapes.size > 1) {
    issues.push({
      id: nextId(),
      severity: "warning",
      category: "Inconsistent build formats",
      description: `Build identifiers use mixed formats: ${builds.join(", ")}.`,
      resolution: "Normalise the build naming so versions group and sort correctly.",
      sourceFile: "Database",
    });
  }

  // Calendar gaps per game.
  const byGame = new Map<string, string[]>();
  records.forEach((r) => {
    if (!r.date || !r.game) return;
    const list = byGame.get(r.game) ?? [];
    list.push(r.date);
    byGame.set(r.game, list);
  });
  byGame.forEach((dates, game) => {
    const unique = Array.from(new Set(dates)).sort();
    for (let i = 1; i < unique.length; i++) {
      const gap = daysBetween(unique[i - 1], unique[i]);
      if (gap > 1) {
        issues.push({
          id: nextId(),
          severity: "warning",
          category: "Data gap",
          description: `${game} has no data between ${unique[i - 1]} and ${unique[i]} (${gap - 1} missing day(s)).`,
          resolution: "Upload the missing days so week-over-week comparisons stay like-for-like.",
          sourceFile: "Database",
        });
      }
    }
  });

  // A retention triangle always has a maturing tail — worth stating, not flagging.
  const retentionRecords = records.filter((r) => r.retentionD1 !== undefined);
  const immature = retentionRecords.filter((r) => r.retentionD7 === undefined).length;
  if (immature > 0) {
    issues.push({
      id: nextId(),
      severity: "info",
      category: "Immature cohorts",
      description: `${immature} cohort(s) have a D1 value but no D7 value yet. These are shown as unavailable, never as zero.`,
      resolution: "No action needed. D7 fills in as each cohort reaches seven days of age.",
      sourceFile: "Database",
    });
  }

  const unweighted = records.some(
    (r) => r.retentionD1 !== undefined && r.cohortSize === undefined && r.newUsers === undefined
  );
  if (unweighted) {
    issues.push({
      id: nextId(),
      severity: "info",
      category: "Unweighted retention average",
      description:
        "The retention export carries no cohort size, so multi-day retention is averaged with equal weight per day rather than per user.",
      resolution: "Upload a cohort-size column to weight the average by the number of users in each cohort.",
      sourceFile: "Database",
    });
  }

  return issues;
}

export function countBySeverity(issues: ValidationIssue[]) {
  const active = issues.filter((i) => !i.excluded);
  return {
    error: active.filter((i) => i.severity === "error").length,
    warning: active.filter((i) => i.severity === "warning").length,
    info: active.filter((i) => i.severity === "info").length,
    total: active.length,
  };
}
