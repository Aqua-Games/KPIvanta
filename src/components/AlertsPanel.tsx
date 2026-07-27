"use client";

import Link from "next/link";
import clsx from "clsx";
import { Alert } from "@/lib/alerts";
import { Card } from "./ui/Card";

const TONE: Record<Alert["severity"], { border: string; dot: string; label: string }> = {
  positive: { border: "border-l-emerald-500", dot: "bg-emerald-500", label: "Improvement" },
  negative: { border: "border-l-red-500", dot: "bg-red-500", label: "Regression" },
  warning: { border: "border-l-amber-500", dot: "bg-amber-500", label: "Warning" },
  info: { border: "border-l-blue-500", dot: "bg-blue-500", label: "Observation" },
};

export function AlertsPanel({
  alerts,
  title = "Insights and alerts",
  limit,
}: {
  alerts: Alert[];
  title?: string;
  limit?: number;
}) {
  const shown = limit ? alerts.slice(0, limit) : alerts;

  return (
    <Card
      title={title}
      question="What changed, and is it big enough to act on?"
      tooltip="Alerts are only raised once a movement clears the minimum change, user-volume and history thresholds, so small samples do not produce conclusions."
    >
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Nothing crossed the alert thresholds for this period.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((alert) => {
            const tone = TONE[alert.severity];
            return (
              <li
                key={alert.id}
                className={clsx("rounded-r-md border-l-4 bg-slate-50/60 px-3 py-2.5", tone.border)}
              >
                <p className="flex items-start gap-2 text-sm font-medium text-slate-900">
                  <span
                    aria-hidden="true"
                    className={clsx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)}
                  />
                  <span>
                    <span className="sr-only">{tone.label}: </span>
                    {alert.headline}
                  </span>
                </p>
                <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-3.5 text-xs text-slate-500">
                  <div className="flex gap-1">
                    <dt className="font-medium">Metric</dt>
                    <dd>{alert.metric}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="font-medium">Basis</dt>
                    <dd>{alert.basis}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="font-medium">Segment</dt>
                    <dd>{alert.scope}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="font-medium">Period</dt>
                    <dd>{alert.period}</dd>
                  </div>
                </dl>
                {alert.link && (
                  <Link
                    href={alert.link.href}
                    className="mt-1 inline-block pl-3.5 text-xs font-medium text-blue-700 hover:underline"
                  >
                    {alert.link.label} →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
