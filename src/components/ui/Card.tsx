"use client";

import { ReactNode, useState } from "react";
import clsx from "clsx";
import { InfoTooltip } from "./InfoTooltip";

interface CardProps {
  title?: string;
  question?: string;
  description?: string;
  tooltip?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  fullscreenable?: boolean;
}

export function Card({
  title,
  question,
  description,
  tooltip,
  actions,
  children,
  className,
  id,
  fullscreenable,
}: CardProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const body = (
    <section
      id={id}
      aria-label={title}
      className={clsx(
        "rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        fullscreen && "fixed inset-4 z-50 overflow-auto",
        className
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                {title}
                {tooltip && <InfoTooltip label={`About ${title}`} content={tooltip} />}
              </h2>
            )}
            {question && <p className="mt-0.5 text-xs text-slate-500">{question}</p>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 no-print">
            {actions}
            {fullscreenable && (
              <button
                type="button"
                onClick={() => setFullscreen((v) => !v)}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                aria-pressed={fullscreen}
              >
                {fullscreen ? "Exit full screen" : "Full screen"}
              </button>
            )}
          </div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );

  if (!fullscreen) return body;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={() => setFullscreen(false)} />
      {body}
    </>
  );
}
