"use client";

import { useId, useState } from "react";

interface InfoTooltipProps {
  content: string;
  label?: string;
}

export function InfoTooltip({ content, label = "More information" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 hover:border-blue-500 hover:text-blue-600"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2.5 text-xs font-normal leading-relaxed text-slate-700 shadow-lg"
        >
          {content}
        </span>
      )}
    </span>
  );
}
