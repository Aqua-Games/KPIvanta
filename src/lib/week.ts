import { DateRange } from "./types";

/** ISO-8601 week key, e.g. "2026-W30". Weeks start on Monday. */
export function isoWeekKey(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
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

/** Monday..Sunday date range covered by an ISO week key. */
export function weekRange(weekKey: string): DateRange | null {
  const match = weekKey.match(/^(\d{4})-W(\d+)$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
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
