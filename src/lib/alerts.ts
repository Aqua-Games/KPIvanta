import {
  KPI_DEFINITIONS,
  KpiId,
  KpiValues,
  changeStatus,
  formatKpi,
  kpisFor,
  percentChange,
} from "./kpi";
import { KpiRecord } from "./types";
import { groupedKpis } from "./select";
import { formatSignedPercent } from "./format";

export interface Alert {
  id: string;
  severity: "positive" | "negative" | "warning" | "info";
  headline: string;
  metric: string;
  basis: string;
  scope: string;
  period: string;
  link?: { href: string; label: string };
}

export interface AlertThresholds {
  /** Minimum absolute percentage change before a movement is worth reporting. */
  minChange: number;
  /** Minimum average DAU before a segment is considered large enough to judge. */
  minDau: number;
  /** Minimum days of data before a comparison is drawn. */
  minDays: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  minChange: 10,
  minDau: 50,
  minDays: 3,
};

interface AlertInput {
  current: KpiRecord[];
  previous: KpiRecord[];
  periodLabel: string;
  comparisonLabel: string;
  thresholds?: AlertThresholds;
  currency?: string;
}

/** KPIs worth alerting on, in the order the PRD lists them. */
const WATCHED: KpiId[] = [
  "retentionD1",
  "retentionD2",
  "retentionD3",
  "retentionD4",
  "retentionD5",
  "retentionD6",
  "retentionD7",
  "dau",
  "playtimePerUserSeconds",
  "arpdau",
  "arpdauAds",
  "impdau",
  "sessionsPerUser",
  "crashRate",
  "anrRate",
  "levelCompletionRate",
];

export function generateAlerts({
  current,
  previous,
  periodLabel,
  comparisonLabel,
  thresholds = DEFAULT_THRESHOLDS,
  currency = current[0]?.currency ?? "USD",
}: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  let seq = 0;
  const nextId = () => `alert-${++seq}`;

  const currentKpis = kpisFor(current);
  const previousKpis = kpisFor(previous);

  const enoughData =
    currentKpis.dayCount >= thresholds.minDays && previousKpis.dayCount >= thresholds.minDays;

  if (!enoughData) {
    return [
      {
        id: nextId(),
        severity: "info",
        headline: `Not enough history to compare ${periodLabel} against ${comparisonLabel}.`,
        metric: "Coverage",
        basis: `At least ${thresholds.minDays} days are required in both periods.`,
        scope: "All data in scope",
        period: periodLabel,
      },
    ];
  }

  const belowVolume =
    currentKpis.dau !== null && currentKpis.dau < thresholds.minDau;

  // --- Headline KPI movements ---
  for (const id of WATCHED) {
    const change = percentChange(currentKpis[id], previousKpis[id]);
    if (change === null || Math.abs(change) < thresholds.minChange) continue;
    if (belowVolume) continue;

    const definition = KPI_DEFINITIONS.find((d) => d.id === id);
    if (!definition) continue;
    const status = changeStatus(id, change, thresholds.minChange);

    alerts.push({
      id: nextId(),
      severity: status === "improved" ? "positive" : status === "worse" ? "negative" : "info",
      headline: `${definition.label} ${change > 0 ? "rose" : "fell"} ${formatSignedPercent(change)} to ${formatKpi(id, currentKpis[id], currency)}.`,
      metric: definition.label,
      basis: `${formatKpi(id, currentKpis[id], currency)} versus ${formatKpi(id, previousKpis[id], currency)} in ${comparisonLabel}`,
      scope: "All data in scope",
      period: periodLabel,
      link: { href: "/historical", label: "Open historical comparison" },
    });
  }

  if (belowVolume && currentKpis.dau !== null) {
    alerts.push({
      id: nextId(),
      severity: "warning",
      headline: `Average DAU is ${Math.round(currentKpis.dau)}, below the ${thresholds.minDau}-user reporting threshold.`,
      metric: "DAU",
      basis: "Movements on a sample this small are not reported as trends.",
      scope: "All data in scope",
      period: periodLabel,
    });
  }

  // --- Build-level regressions ---
  const buildGroups = groupedKpis(current, "build").filter(
    (g) => g.dau !== null && g.dau >= thresholds.minDau
  );
  if (buildGroups.length >= 2) {
    const ordered = [...buildGroups].sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { numeric: true })
    );
    const latest = ordered[ordered.length - 1];
    const prior = ordered[ordered.length - 2];

    for (const id of ["retentionD1", "retentionD2", "retentionD3", "retentionD7", "crashRate", "arpdau"] as KpiId[]) {
      const change = percentChange(latest[id], prior[id]);
      if (change === null || Math.abs(change) < thresholds.minChange) continue;
      const definition = KPI_DEFINITIONS.find((d) => d.id === id);
      if (!definition) continue;
      const status = changeStatus(id, change, thresholds.minChange);
      alerts.push({
        id: nextId(),
        severity: status === "improved" ? "positive" : "negative",
        headline: `Build ${latest.key} has ${formatSignedPercent(change)} ${definition.label} versus build ${prior.key} (${formatKpi(id, latest[id], currency)} vs ${formatKpi(id, prior[id], currency)}).`,
        metric: definition.label,
        basis: `Build ${latest.key} against build ${prior.key}, both above the ${thresholds.minDau}-DAU threshold`,
        scope: `Builds ${prior.key} → ${latest.key}`,
        period: periodLabel,
        link: { href: "/builds", label: "Open build comparison" },
      });
    }
  }

  // --- Adoption concentration ---
  const totalDau = buildGroups.reduce((sum, g) => sum + (g.dauTotal ?? 0), 0);
  if (totalDau > 0 && buildGroups.length >= 2) {
    const ordered = [...buildGroups].sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { numeric: true })
    );
    const latest = ordered[ordered.length - 1];
    const share = ((latest.dauTotal ?? 0) / totalDau) * 100;
    if (share < 50) {
      alerts.push({
        id: nextId(),
        severity: "warning",
        headline: `Only ${share.toFixed(0)}% of active users are on the newest build (${latest.key}).`,
        metric: "Build adoption",
        basis: "Share of DAU on the highest build number in the selected period",
        scope: `Build ${latest.key}`,
        period: periodLabel,
        link: { href: "/builds", label: "Open build comparison" },
      });
    }
  }

  // --- Best and worst game ---
  const gameGroups = groupedKpis(current, "game").filter(
    (g) => g.dau !== null && g.dau >= thresholds.minDau
  );
  if (gameGroups.length >= 2) {
    const withArpdau = gameGroups.filter((g) => g.arpdau !== null);
    if (withArpdau.length >= 2) {
      const sorted = [...withArpdau].sort((a, b) => (b.arpdau ?? 0) - (a.arpdau ?? 0));
      alerts.push({
        id: nextId(),
        severity: "info",
        headline: `${sorted[0].key} leads on ARPDAU at ${formatKpi("arpdau", sorted[0].arpdau, currency)}; ${sorted[sorted.length - 1].key} trails at ${formatKpi("arpdau", sorted[sorted.length - 1].arpdau, currency)}.`,
        metric: "ARPDAU",
        basis: `${withArpdau.length} games above the ${thresholds.minDau}-DAU threshold`,
        scope: "Cross-game comparison",
        period: periodLabel,
        link: { href: "/monetization", label: "Open monetization" },
      });
    }
  }

  return alerts;
}

export type { KpiValues };
