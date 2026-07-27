"use client";

import { useMemo, useSyncExternalStore } from "react";
import { demoRecords, useStore } from "./useStore";
import { applyFilters, dataDateRange, distinctValues } from "@/lib/select";
import { validateDatabase } from "@/lib/validation";
import { mergeRecords } from "@/lib/merge";
import { KpiRecord } from "@/lib/types";

const subscribeNever = () => () => {};

/**
 * Single source of truth for every page: resolves demo versus imported data,
 * applies the global filters and derives the comparison window.
 *
 * `hydrated` guards against rendering persisted client state during SSR, which
 * would otherwise produce a hydration mismatch.
 */
export function useData() {
  const records = useStore((s) => s.records);
  const files = useStore((s) => s.files);
  const filters = useStore((s) => s.filters);
  const granularity = useStore((s) => s.granularity);
  const comparisonMode = useStore((s) => s.comparisonMode);
  const lastRefresh = useStore((s) => s.lastRefresh);

  // False during server rendering and the first client pass, true afterwards.
  // Persisted localStorage state must not be rendered until then.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

  const isDemo = records.length === 0;
  const rawRecords: KpiRecord[] = useMemo(
    () => (isDemo ? demoRecords() : records),
    [isDemo, records]
  );

  // Complementary uploads (DAU here, playtime there) are combined so ratios
  // spanning two files — playtime per user, ARPDAU by build — can be computed.
  const { records: source, conflicts } = useMemo(
    () => mergeRecords(rawRecords),
    [rawRecords]
  );

  const fullRange = useMemo(() => dataDateRange(source), [source]);

  // Until the user picks a range, default to the most recent four weeks of data.
  const effectiveFilters = useMemo(() => {
    if (filters.dateRange || !fullRange) return filters;
    const end = fullRange.end;
    const startDate = new Date(end + "T00:00:00Z");
    startDate.setUTCDate(startDate.getUTCDate() - 27);
    const start = startDate.toISOString().slice(0, 10);
    const dateRange = { start: start < fullRange.start ? fullRange.start : start, end };
    const span =
      (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000 + 1;
    const compareStart = new Date(dateRange.start + "T00:00:00Z");
    compareStart.setUTCDate(compareStart.getUTCDate() - span);
    const compareEnd = new Date(dateRange.start + "T00:00:00Z");
    compareEnd.setUTCDate(compareEnd.getUTCDate() - 1);
    return {
      ...filters,
      dateRange,
      compareRange:
        comparisonMode === "none"
          ? null
          : {
              start: compareStart.toISOString().slice(0, 10),
              end: compareEnd.toISOString().slice(0, 10),
            },
    };
  }, [filters, fullRange, comparisonMode]);

  const current = useMemo(
    () => applyFilters(source, effectiveFilters),
    [source, effectiveFilters]
  );

  const previous = useMemo(() => {
    if (!effectiveFilters.compareRange) return [] as KpiRecord[];
    return applyFilters(source, {
      ...effectiveFilters,
      dateRange: effectiveFilters.compareRange,
    });
  }, [source, effectiveFilters]);

  const facets = useMemo(
    () => ({
      games: distinctValues(source, "game"),
      platforms: distinctValues(source, "platform"),
      countries: distinctValues(source, "country"),
      builds: distinctValues(source, "build"),
      sources: distinctValues(source, "source"),
      weeks: distinctValues(source, "week").reverse(),
    }),
    [source]
  );

  const issues = useMemo(
    () => [...conflicts, ...validateDatabase(source, files)],
    [conflicts, source, files]
  );

  return {
    hydrated,
    isDemo,
    allRecords: source,
    current,
    previous,
    facets,
    issues,
    files,
    filters: effectiveFilters,
    granularity,
    comparisonMode,
    fullRange,
    lastRefresh,
  };
}
