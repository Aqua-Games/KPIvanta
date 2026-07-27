"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { useData } from "@/store/useData";
import { Filters, SOURCE_LABELS, SourceId } from "@/lib/types";
import { MultiSelect } from "./MultiSelect";
import { Badge } from "../ui/Badge";
import { weekLabel } from "@/lib/week";

const FILTERS: { key: keyof Filters; label: string; facet: keyof ReturnType<typeof useData>["facets"] }[] = [
  { key: "games", label: "Game", facet: "games" },
  { key: "platforms", label: "Platform", facet: "platforms" },
  { key: "countries", label: "Country", facet: "countries" },
  { key: "builds", label: "Build", facet: "builds" },
  { key: "weeks", label: "Week", facet: "weeks" },
  { key: "sources", label: "Data source", facet: "sources" },
];

export function FilterBar() {
  const { facets, filters, hydrated } = useData();
  const toggleFilter = useStore((s) => s.toggleFilter);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const savedViews = useStore((s) => s.savedViews);
  const saveView = useStore((s) => s.saveView);
  const applyView = useStore((s) => s.applyView);
  const deleteView = useStore((s) => s.deleteView);

  const [expanded, setExpanded] = useState(false);
  const [viewName, setViewName] = useState("");

  const activeCount = FILTERS.reduce((sum, f) => {
    const value = filters[f.key];
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);

  const chips = FILTERS.flatMap((f) => {
    const value = filters[f.key];
    if (!Array.isArray(value)) return [];
    return (value as string[]).map((v) => ({
      key: f.key,
      label: f.label,
      value: v,
      display: labelFor(f.key, v),
    }));
  });

  return (
    <section aria-label="Global filters" className="border-b border-slate-200 bg-white no-print">
      <div className="mx-auto max-w-[1600px] px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
            Filters
            {hydrated && activeCount > 0 && <Badge tone="primary">{activeCount} active</Badge>}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {savedViews.length > 0 && (
              <>
                <label htmlFor="saved-view" className="sr-only">
                  Saved views
                </label>
                <select
                  id="saved-view"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                  defaultValue=""
                  onChange={(e) => e.target.value && applyView(e.target.value)}
                >
                  <option value="">Saved views…</option>
                  {savedViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => deleteView(savedViews[savedViews.length - 1].id)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Delete last view
                </button>
              </>
            )}
            <label htmlFor="view-name" className="sr-only">
              Name this view
            </label>
            <input
              id="view-name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Name this view"
              className="w-36 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={!viewName.trim()}
              onClick={() => {
                saveView(viewName.trim());
                setViewName("");
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save view
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={activeCount === 0}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Clear all
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {FILTERS.map((f) => (
              <MultiSelect
                key={String(f.key)}
                label={f.label}
                options={facets[f.facet]}
                selected={(filters[f.key] as string[]) ?? []}
                onToggle={(value) => toggleFilter(f.key, value)}
                onClear={() => setFilter(f.key, [] as never)}
                renderOption={(v) => labelFor(f.key, v)}
              />
            ))}
          </div>
        )}

        {hydrated && chips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Scope</span>
            {chips.map((chip) => (
              <button
                key={`${String(chip.key)}-${chip.value}`}
                type="button"
                onClick={() => toggleFilter(chip.key, chip.value)}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-600/20 hover:bg-blue-100"
              >
                {chip.label}: {chip.display}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove this filter</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function labelFor(key: keyof Filters, value: string): string {
  if (key === "sources") return SOURCE_LABELS[value as SourceId] ?? value;
  if (key === "weeks") return weekLabel(value);
  return value;
}
