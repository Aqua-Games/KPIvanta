/** Cell-level value interpretation: missing tokens, numbers, percentages, dates. */

const MISSING_TOKENS = new Set([
  "",
  "-",
  "--",
  "---",
  "n/a",
  "na",
  "n.a.",
  "null",
  "nil",
  "none",
  "—",
  "–",
  "#n/a",
  "undefined",
]);

export type CellKind = "missing" | "number" | "percent" | "currency" | "date" | "text";

export function isMissingCell(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null) return true;
  return MISSING_TOKENS.has(raw.trim().toLowerCase());
}

const CURRENCY_RE = /[£$€¥₹]/;

/**
 * Parses a numeric cell. Handles currency symbols, thousands separators,
 * European decimal commas, percentages and parenthesised negatives.
 * Returns undefined for missing values — never 0.
 */
export function parseNumber(raw: string | undefined | null): number | undefined {
  if (isMissingCell(raw)) return undefined;
  let s = String(raw).trim();

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  const isPercent = s.includes("%");
  s = s.replace(/%/g, "").replace(CURRENCY_RE, "").replace(/\s/g, "");
  s = s.replace(/[A-Za-z]/g, "");

  // Decide which separator is decimal: "1.234,56" (EU) vs "1,234.56" (US).
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const decimals = s.length - lastComma - 1;
    // "1,234" is a thousands separator; "0,35" is a decimal comma.
    s = decimals === 3 && /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }

  if (s === "" || s === "-" || s === ".") return undefined;
  let value = Number.parseFloat(s);
  if (Number.isNaN(value)) return undefined;
  if (negative) value = -value;
  if (isPercent) return value; // already expressed on a 0-100 scale
  return value;
}

export function looksLikePercentString(raw: string): boolean {
  return raw.includes("%");
}

export function detectCurrency(raw: string): string | undefined {
  if (raw.includes("£")) return "GBP";
  if (raw.includes("€")) return "EUR";
  if (raw.includes("¥")) return "JPY";
  if (raw.includes("₹")) return "INR";
  if (raw.includes("$")) return "USD";
  const code = raw.match(/\b(GBP|USD|EUR|JPY|INR|AUD|CAD)\b/);
  return code ? code[1] : undefined;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Returns ISO yyyy-MM-dd, or undefined when the cell is not a date. */
export function parseDate(raw: string | undefined | null): string | undefined {
  if (isMissingCell(raw)) return undefined;
  const s = String(raw).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // dd/mm/yyyy or mm/dd/yyyy — disambiguated by which part exceeds 12.
  const slash = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (slash) {
    let first = parseInt(slash[1], 10);
    let second = parseInt(slash[2], 10);
    const year = slash[3];
    // Ambiguous pairs default to day-first, matching GameAnalytics and AdMob exports.
    if (first > 12) {
      // first is the day
    } else if (second > 12) {
      [first, second] = [second, first];
    }
    return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
  }

  // "16 July 2026", "July 16, 2026", "Jul 16 2026"
  const named = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[1].slice(0, 3).toLowerCase()];
    if (month) {
      return `${named[3]}-${String(month).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
    }
  }
  const namedDayFirst = s.match(/^(\d{1,2})\s+([A-Za-z]{3,}),?\s+(\d{4})$/);
  if (namedDayFirst) {
    const month = MONTHS[namedDayFirst[2].slice(0, 3).toLowerCase()];
    if (month) {
      return `${namedDayFirst[3]}-${String(month).padStart(2, "0")}-${namedDayFirst[1].padStart(2, "0")}`;
    }
  }

  return undefined;
}

export function classifyCells(samples: string[]): CellKind {
  const values = samples.filter((s) => !isMissingCell(s));
  if (values.length === 0) return "missing";
  if (values.every((v) => v.includes("%"))) return "percent";
  if (values.every((v) => CURRENCY_RE.test(v))) return "currency";
  if (values.every((v) => parseDate(v) !== undefined)) return "date";
  if (values.every((v) => parseNumber(v) !== undefined)) return "number";
  return "text";
}

/**
 * Rates arrive either as 0–1 fractions (GameAnalytics retention: 0.3012) or as
 * 0–100 percentages (AdMob: "74.98%"). Detect which so both land on one scale.
 */
export function looksLikeFractionRate(samples: string[]): boolean {
  const numbers = samples
    .filter((s) => !isMissingCell(s) && !s.includes("%"))
    .map(parseNumber)
    .filter((n): n is number => n !== undefined);
  if (numbers.length === 0) return false;
  return numbers.every((n) => n >= 0 && n <= 1) && numbers.some((n) => n > 0 && n < 1);
}
