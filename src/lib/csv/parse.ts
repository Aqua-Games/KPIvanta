import { ParsedTable, ReportKind, SourceId } from "../types";
import { decodeBuffer, detectDelimiter, splitRespectingQuotes } from "./decode";
import { classifyCells, isMissingCell, looksLikeFractionRate, parseDate, parseNumber } from "./values";
import {
  DERIVED_HEADERS,
  EXACT_HEADERS,
  FUZZY_RULES,
  normalizeHeader,
} from "./fields";
import { ColumnPlan } from "../types";

/* ------------------------------------------------------------------ */
/* Raw table extraction                                                */
/* ------------------------------------------------------------------ */

const HEADER_KEYWORDS = [
  "date", "day", "app", "game", "build", "version", "country", "platform",
  "dau", "retention", "playtime", "session", "revenue", "earnings", "impression",
  "request", "click", "crash", "anr", "level", "user", "rate", "ecpm", "currency",
];

const DATE_RANGE_RE =
  /([A-Z][a-z]+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})\s*(?:-|–|to)\s*([A-Z][a-z]+ \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})/;

function isBlank(row: string[]): boolean {
  return row.every((c) => c.trim() === "");
}

function filled(row: string[]): number {
  return row.filter((c) => c.trim() !== "").length;
}

function isTotalRow(row: string[]): boolean {
  const first = (row[0] ?? "").trim().toLowerCase();
  return first.startsWith("total") || first.startsWith("grand total") || first === "sum";
}

function headerScore(row: string[]): number {
  let score = 0;
  for (const cell of row) {
    const norm = normalizeHeader(cell);
    if (!norm) continue;
    if (HEADER_KEYWORDS.some((kw) => norm.includes(kw))) score += 1;
    if (parseNumber(cell) !== undefined) score -= 1.5; // headers are not numbers
  }
  return score;
}

export function parseTable(text: string, encoding: string): ParsedTable {
  const delimiter = detectDelimiter(text);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const allRows = lines.map((line) => splitRespectingQuotes(line, delimiter).map((c) => c.trim()));

  const titleRows: string[] = [];
  let dateRangeText: string | undefined;
  let detectedPeriod: { start: string; end: string } | undefined;
  let blankRowCount = 0;
  let headerRowIndex = -1;

  const scanLimit = Math.min(allRows.length, 12);
  for (let i = 0; i < scanLimit; i++) {
    const row = allRows[i];
    if (isBlank(row)) {
      blankRowCount++;
      continue;
    }

    const joined = row.join(" ").trim();
    const rangeMatch = joined.match(DATE_RANGE_RE);
    if (rangeMatch && filled(row) <= 2) {
      dateRangeText = joined;
      const start = parseDate(rangeMatch[1]);
      const end = parseDate(rangeMatch[2]);
      if (start && end) detectedPeriod = { start, end };
      continue;
    }

    // A single populated cell above the table is a report title, not a header.
    if (filled(row) === 1 && headerScore(row) < 2) {
      titleRows.push(joined);
      continue;
    }

    if (filled(row) >= 2 && headerScore(row) >= 1) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = allRows.findIndex((r) => !isBlank(r));
    if (headerRowIndex === -1) headerRowIndex = 0;
  }

  const headers = (allRows[headerRowIndex] ?? []).map((h) => h.trim());
  const rows: string[][] = [];
  const footerRows: string[][] = [];

  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (isBlank(row)) {
      blankRowCount++;
      continue;
    }
    if (isTotalRow(row)) {
      footerRows.push(row);
      continue;
    }
    rows.push(row);
  }

  return {
    encoding,
    delimiter,
    titleRows,
    dateRangeText,
    detectedPeriod,
    headerRowIndex,
    headers,
    rows,
    footerRows,
    blankRowCount,
  };
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  const { text, encoding } = decodeBuffer(buffer);
  return parseTable(text, encoding);
}

/* ------------------------------------------------------------------ */
/* Source and report-kind detection                                    */
/* ------------------------------------------------------------------ */

/** "DAU 2.0" -> { metric: "dau", build: "2.0" }; "Playtime per user 1.9" likewise. */
export function splitBuildSuffix(header: string): { base: string; build: string } | null {
  const match = header.trim().match(/^(.*?)[\s_-]+v?(\d+(?:\.\d+)+[a-z0-9.-]*)$/i);
  if (!match) return null;
  const base = normalizeHeader(match[1]);
  if (!base) return null;
  return { base, build: match[2] };
}

/** ISO-3166 alpha-2 codes that appear as column suffixes in per-country exports. */
const COUNTRY_CODES = new Set([
  "US", "CA", "GB", "UK", "AU", "NZ", "IE", "IN", "PK", "BD", "LK", "JP", "KR",
  "CN", "TW", "HK", "SG", "MY", "TH", "VN", "PH", "ID", "DE", "FR", "IT", "ES",
  "PT", "NL", "BE", "AT", "CH", "SE", "NO", "DK", "FI", "PL", "CZ", "SK", "HU",
  "RO", "BG", "GR", "TR", "RU", "UA", "BR", "MX", "AR", "CL", "CO", "PE", "ZA",
  "EG", "NG", "KE", "MA", "SA", "AE", "IL", "QA", "KW",
]);

/** "Retention US" -> { base: "retention", country: "US" }. */
export function splitCountrySuffix(header: string): { base: string; country: string } | null {
  const match = header.trim().match(/^(.*?)[\s_-]+([A-Za-z]{2})$/);
  if (!match) return null;
  const code = match[2].toUpperCase();
  if (!COUNTRY_CODES.has(code)) return null;
  const base = normalizeHeader(match[1]);
  if (!base) return null;
  return { base, country: code === "UK" ? "GB" : code };
}

/** "Retention 3" -> 3. GameAnalytics numbers retention columns by day. */
export function retentionDayFromHeader(header: string): number | null {
  const match = normalizeHeader(header).match(/^retention\s*(?:day\s*)?(\d+)$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  return day >= 1 && day <= 30 ? day : null;
}

export interface DetectionResult {
  source: SourceId;
  reportKind: ReportKind;
  confidence: number;
  /** Present when the file identifies a currency in its headers, e.g. "(GBP)". */
  currency?: string;
  notes: string[];
}

export function detectReport(table: ParsedTable): DetectionResult {
  const normalized = table.headers.map(normalizeHeader);
  const notes: string[] = [];

  const retentionColumns = table.headers.filter((h) => retentionDayFromHeader(h) !== null);
  const buildColumns = table.headers.filter((h) => splitBuildSuffix(h) !== null);
  const hasDate = normalized.some((h) => h === "date" || h === "day");

  // Currency is often embedded in AdMob-style headers: "Estimated earnings (GBP)".
  let currency: string | undefined;
  for (const header of table.headers) {
    const match = header.match(/\((GBP|USD|EUR|JPY|INR|AUD|CAD)\)/i);
    if (match) {
      currency = match[1].toUpperCase();
      break;
    }
  }

  const admobSignals = ["matched requests", "observed ecpm", "impdau", "bid requests", "dav"];
  const admobHits = admobSignals.filter((s) =>
    normalized.some((h) => h.replace(/\s*(gbp|usd|eur)\s*/g, "").trim().includes(s))
  ).length;

  if (admobHits >= 2) {
    notes.push("Recognised as an AdMob ad-performance export (one row per app).");
    return {
      source: "admob",
      reportKind: "ad_performance_by_app",
      confidence: 90,
      currency,
      notes,
    };
  }

  if (hasDate && retentionColumns.length >= 2) {
    notes.push(
      `Retention report with ${retentionColumns.length} day columns. Blank cells mean the cohort has not matured yet, not zero retention.`
    );
    return { source: "gameanalytics", reportKind: "retention_by_day", confidence: 88, currency, notes };
  }

  if (hasDate && buildColumns.length >= 2) {
    const builds = Array.from(
      new Set(buildColumns.map((h) => splitBuildSuffix(h)!.build))
    );
    notes.push(`Wide report split by build: ${builds.join(", ")}. Columns are unpivoted into build rows.`);
    return { source: "gameanalytics", reportKind: "metric_by_build", confidence: 85, currency, notes };
  }

  const countryColumns = table.headers.filter((h) => splitCountrySuffix(h) !== null);
  if (hasDate && countryColumns.length >= 2) {
    const countries = Array.from(
      new Set(countryColumns.map((h) => splitCountrySuffix(h)!.country))
    );
    notes.push(
      `Wide report split by country: ${countries.join(", ")}. Columns are unpivoted into country rows.`
    );
    return { source: "gameanalytics", reportKind: "metric_by_country", confidence: 82, currency, notes };
  }

  if (hasDate) {
    notes.push("Row-per-date report.");
    return { source: "generic", reportKind: "long_format", confidence: 60, currency, notes };
  }

  notes.push("No date column found. Set the reporting period manually before importing.");
  return { source: "generic", reportKind: "unknown", confidence: 20, currency, notes };
}

/* ------------------------------------------------------------------ */
/* Column plan (suggested mapping)                                     */
/* ------------------------------------------------------------------ */

function suggestField(header: string): { field: string | null; confidence: number } {
  const norm = normalizeHeader(header);
  // Strip a trailing currency qualifier so "estimated earnings gbp" still matches.
  const withoutCurrency = norm.replace(/\s*(gbp|usd|eur|jpy|inr|aud|cad)\s*$/g, "").trim();

  if (DERIVED_HEADERS.has(norm) || DERIVED_HEADERS.has(withoutCurrency)) {
    return { field: null, confidence: 100 }; // recognised, deliberately not imported
  }
  if (EXACT_HEADERS[norm]) return { field: EXACT_HEADERS[norm], confidence: 95 };
  if (EXACT_HEADERS[withoutCurrency]) return { field: EXACT_HEADERS[withoutCurrency], confidence: 92 };

  for (const rule of FUZZY_RULES) {
    if (rule.pattern.test(withoutCurrency)) {
      return { field: rule.field, confidence: 60 };
    }
  }
  return { field: null, confidence: 0 };
}

export function buildColumnPlan(table: ParsedTable, kind: ReportKind): ColumnPlan[] {
  // Retention columns share one scale decision. Deciding per column would misread
  // a sparse column (D7 in a young cohort triangle) that has no populated cells.
  const retentionSamples = table.headers.flatMap((header, index) =>
    retentionDayFromHeader(header) === null
      ? []
      : table.rows.map((r) => r[index] ?? "").filter((v) => !isMissingCell(v))
  );
  const retentionIsFraction = looksLikeFractionRate(retentionSamples);

  // Same file-level decision for country-split columns ("Retention US", …).
  const countrySamples = table.headers.flatMap((header, index) =>
    splitCountrySuffix(header) === null
      ? []
      : table.rows.map((r) => r[index] ?? "").filter((v) => !isMissingCell(v))
  );
  const countryIsFraction = looksLikeFractionRate(countrySamples);

  return table.headers.map((header, index) => {
    const samples = table.rows
      .slice(0, 12)
      .map((r) => r[index] ?? "")
      .filter((v) => !isMissingCell(v));
    const kindOfCell = classifyCells(samples);
    const dataType =
      kindOfCell === "date"
        ? "date"
        : kindOfCell === "currency"
          ? "currency"
          : kindOfCell === "percent"
            ? "rate"
            : kindOfCell === "number"
              ? "number"
              : "string";

    const base: ColumnPlan = {
      sourceColumn: header,
      targetField: null,
      confidence: 0,
      ignored: false,
      dataType,
      sampleValues: samples.slice(0, 3),
    };

    const retentionDay = retentionDayFromHeader(header);
    if (kind === "retention_by_day" && retentionDay !== null) {
      return {
        ...base,
        targetField: retentionDay <= 7 || retentionDay === 30 ? `retentionD${retentionDay}` : null,
        retentionDay,
        confidence: 95,
        dataType: "rate",
        fractionRate: retentionIsFraction,
        ignored: !(retentionDay <= 7 || retentionDay === 30),
      };
    }

    const countrySplit = splitCountrySuffix(header);
    if (kind === "metric_by_country" && countrySplit) {
      const suggestion = suggestField(countrySplit.base);
      const isRate = suggestion.field?.startsWith("retention") ?? false;
      return {
        ...base,
        targetField: suggestion.field,
        country: countrySplit.country,
        confidence: suggestion.field ? Math.max(suggestion.confidence, 80) : 0,
        ignored: false,
        dataType: isRate ? "rate" : base.dataType,
        fractionRate: isRate ? countryIsFraction : looksLikeFractionRate(samples),
      };
    }

    const buildSplit = splitBuildSuffix(header);
    if (kind === "metric_by_build" && buildSplit) {
      const suggestion = suggestField(buildSplit.base);
      return {
        ...base,
        targetField: suggestion.field,
        build: buildSplit.build,
        confidence: suggestion.field ? Math.max(suggestion.confidence, 85) : 0,
        ignored: false,
        fractionRate: looksLikeFractionRate(samples),
      };
    }

    const suggestion = suggestField(header);
    return {
      ...base,
      targetField: suggestion.field,
      confidence: suggestion.confidence,
      // A recognised derived column is ignored by default rather than left dangling.
      ignored: suggestion.field === null && suggestion.confidence === 100,
      fractionRate: dataType === "rate" ? looksLikeFractionRate(samples) : undefined,
    };
  });
}
