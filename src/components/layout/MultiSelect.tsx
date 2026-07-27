"use client";

import { useMemo, useRef, useState, useEffect, useId } from "react";
import clsx from "clsx";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  renderOption?: (value: string) => string;
}

export function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
  renderOption,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const filtered = useMemo(
    () => options.filter((o) => (renderOption ? renderOption(o) : o).toLowerCase().includes(query.toLowerCase())),
    [options, query, renderOption]
  );

  const summary =
    selected.length === 0 ? "All" : selected.length === 1 ? (renderOption ? renderOption(selected[0]) : selected[0]) : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        disabled={options.length === 0}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
          selected.length > 0
            ? "border-blue-300 bg-blue-50 text-blue-800"
            : "border-slate-300 bg-white text-slate-700"
        )}
      >
        <span className="min-w-0 truncate">
          <span className="text-xs text-slate-500">{label}: </span>
          {summary}
        </span>
        <span aria-hidden="true" className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            aria-label={`Search ${label}`}
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <ul id={listId} role="listbox" aria-multiselectable className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-1 py-2 text-xs text-slate-500">No matching values</li>
            )}
            {filtered.map((option) => {
              const checked = selected.includes(option);
              return (
                <li key={option}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(option)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <span className="truncate">{renderOption ? renderOption(option) : option}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Clear {label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
