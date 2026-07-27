import clsx from "clsx";
import { ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative" | "warning" | "primary" | "version";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  negative: "bg-red-50 text-red-700 ring-red-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  primary: "bg-blue-50 text-blue-700 ring-blue-600/20",
  version: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
