import { KPI_DEFINITIONS, KpiId, KpiValues, percentChange } from "./kpi";

export interface ScoreComponent {
  id: KpiId;
  label: string;
  current: number | null;
  baseline: number | null;
  change: number | null;
  /** -100..100, positive meaning better than the baseline. */
  contribution: number | null;
  weight: number;
}

export interface PerformanceScore {
  /** 0-100. 50 means "level with the baseline". */
  value: number | null;
  components: ScoreComponent[];
  coverage: number; // share of weighted KPIs that had comparable data
  interpretation: string;
}

const SCORED = KPI_DEFINITIONS.filter((d) => d.scored);

/** Change is capped so one volatile KPI cannot dominate the composite. */
const CAP = 50;

/**
 * Composite performance score comparing a period against a baseline period.
 * KPIs with no comparable data are excluded rather than counted as neutral,
 * and the resulting coverage is reported alongside the score.
 */
export function performanceScore(
  current: KpiValues,
  baseline: KpiValues
): PerformanceScore {
  const components: ScoreComponent[] = [];
  let weightedSum = 0;
  let usedWeight = 0;
  let totalWeight = 0;

  for (const definition of SCORED) {
    const weight = definition.scoreWeight ?? 1;
    totalWeight += weight;

    const currentValue = current[definition.id];
    const baselineValue = baseline[definition.id];
    const change = percentChange(currentValue, baselineValue);

    let contribution: number | null = null;
    if (change !== null) {
      const directed = definition.direction === "lower_better" ? -change : change;
      contribution = Math.max(-CAP, Math.min(CAP, directed));
      weightedSum += contribution * weight;
      usedWeight += weight;
    }

    components.push({
      id: definition.id,
      label: definition.label,
      current: currentValue,
      baseline: baselineValue,
      change,
      contribution,
      weight,
    });
  }

  if (usedWeight === 0) {
    return {
      value: null,
      components,
      coverage: 0,
      interpretation: "Not enough overlapping data to score this period against the baseline.",
    };
  }

  const meanContribution = weightedSum / usedWeight; // -50..50
  const value = Math.round(Math.max(0, Math.min(100, 50 + meanContribution)));
  const coverage = (usedWeight / totalWeight) * 100;

  return { value, components, coverage, interpretation: interpret(value, coverage) };
}

function interpret(value: number, coverage: number): string {
  const confidence = coverage < 40 ? " Based on a small share of the KPI set — treat as indicative." : "";
  if (value >= 70) return `Clearly ahead of the baseline period.${confidence}`;
  if (value >= 55) return `Modestly ahead of the baseline period.${confidence}`;
  if (value > 45) return `Broadly level with the baseline period.${confidence}`;
  if (value > 30) return `Modestly behind the baseline period.${confidence}`;
  return `Clearly behind the baseline period.${confidence}`;
}

export function scoreTone(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null) return "neutral";
  if (value >= 55) return "positive";
  if (value <= 45) return "negative";
  return "neutral";
}
