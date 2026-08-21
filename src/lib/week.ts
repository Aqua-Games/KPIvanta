import { DateRange } from "./types";

/**
 * Which day a reporting week begins on.
 *
 * Google Ads and the GA4 explore tool export Sunday-to-Saturday weeks, so a
 * Monday-start (ISO) calendar would split every one of those exports across two
 * weeks — leaving a one-day week beside a six-day one and making any additive
 * comparison, spend or revenue, wrong by roughly six times. Sunday is therefore
 * the default; ISO remains available for sources that use it.
 */
export type WeekStart =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

/** Matches JavaScript's getUTCDay(), where Sunday is 0. */
const DAY_INDEX: Record<WeekStart, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const WEEK_STARTS = Object.keys(DAY_INDEX) as WeekStart[];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "Sunday – Saturday", "Tuesday – Monday", and so on. */
export function weekStartLabel(start: WeekStart): string {
  const first = DAY_INDEX[start];
  return `${DAY_NAMES[first]} – ${DAY_NAMES[(first + 6) % 7]}`;
}

export const DEFAULT_WEEK_START: WeekStart = "sunday";

/**
 * Module-level because week keys are stamped deep inside parsing and
 * aggregation, far from any component that knows the project's preference.
 */
let weekStart: WeekStart = DEFAULT_WEEK_START;

export function setWeekStart(start: WeekStart) {
  weekStart = start;
}

export function getWeekStart(): WeekStart {
  return weekStart;
}

/** Days from the week's first day to `date`, 0-6. */
function offsetIntoWeek(date: Date, start: WeekStart): number {
  return (date.getUTCDay() - DAY_INDEX[start] + 7) % 7;
}

/**
 * Week key such as "2026-W33".
 *
 * Whatever the start day, a week is numbered by the year that owns its midpoint
 * (its fourth day), so a week spanning New Year belongs to one year rather than
 * being split. With a Monday start this is exactly the ISO-8601 rule.
 */
export function isoWeekKey(iso: string, start: WeekStart = weekStart): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";

  const midpointOffset = 3; // the week's fourth day
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  target.setUTCDate(target.getUTCDate() - offsetIntoWeek(target, start) + midpointOffset);

  // The week containing 4 January always belongs to that year under both rules.
  const anchor = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  anchor.setUTCDate(anchor.getUTCDate() - offsetIntoWeek(anchor, start) + midpointOffset);

  const week = 1 + Math.round((target.getTime() - anchor.getTime()) / (7 * 86400000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekNumber(weekKey: string): number {
  const match = weekKey.match(/W(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function weekLabel(weekKey: string): string {
  const match = weekKey.match(/^(\d{4})-W(\d+)$/);
  if (!match) return weekKey;
  return `Week ${parseInt(match[2], 10)}, ${match[1]}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parts(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

/**
 * Compact date span, collapsing whatever the two ends share:
 * "20–26 Jul 2026", "29 Jun – 5 Jul 2026", "30 Dec 2025 – 5 Jan 2026".
 */
export function rangeLabel(range: DateRange): string {
  const from = parts(range.start);
  const to = parts(range.end);

  if (from.year !== to.year) {
    return `${from.day} ${MONTH_NAMES[from.month]} ${from.year} – ${to.day} ${MONTH_NAMES[to.month]} ${to.year}`;
  }
  if (from.month !== to.month) {
    return `${from.day} ${MONTH_NAMES[from.month]} – ${to.day} ${MONTH_NAMES[to.month]} ${to.year}`;
  }
  return `${from.day}–${to.day} ${MONTH_NAMES[from.month]} ${from.year}`;
}

/** Week number together with the days it covers, for selectors and filters. */
export function weekLabelWithRange(weekKey: string): string {
  const range = weekRange(weekKey);
  return range ? `${weekLabel(weekKey)} · ${rangeLabel(range)}` : weekLabel(weekKey);
}

/** The seven days a week key covers, under the configured convention. */
export function weekRange(weekKey: string, start: WeekStart = weekStart): DateRange | null {
  const match = weekKey.match(/^(\d{4})-W(\d+)$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const first = new Date(jan4);
  first.setUTCDate(jan4.getUTCDate() - offsetIntoWeek(jan4, start) + (week - 1) * 7);
  const last = new Date(first);
  last.setUTCDate(first.getUTCDate() + 6);
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

export function previousWeekKey(weekKey: string): string {
  const range = weekRange(weekKey);
  if (!range) return weekKey;
  const d = new Date(range.start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return isoWeekKey(d.toISOString().slice(0, 10));
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00Z").getTime();
  const b = new Date(end + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

/** The equal-length range immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const span = daysBetween(range.start, range.end) + 1;
  return { start: addDays(range.start, -span), end: addDays(range.end, -span) };
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
