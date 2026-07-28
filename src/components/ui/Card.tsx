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
        "panel",
        fullscreen && "fixed inset-4 z-50 overflow-auto shadow-2xl",
        className
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-1 pt-3.5 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-900">
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
                aria-pressed={fullscreen}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
              >
                {fullscreen ? "Exit full screen" : "Expand"}
              </button>
            )}
          </div>
        </header>
      )}
      <div className={clsx("p-4 sm:p-5", (title || actions) && "pt-3")}>{children}</div>
    </section>
  );

  if (!fullscreen) return body;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={() => setFullscreen(false)}
      />
      {body}
    </>
  );
}
