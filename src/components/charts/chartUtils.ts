import { KpiId, KPI_BY_ID } from "@/lib/kpi";
import { formatCompactNumber } from "@/lib/format";
import { currencySymbol } from "@/lib/format";

/** One palette used everywhere so a build keeps its colour across every chart. */
export const SERIES_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#0891b2",
  "#db2777",
  "#475569",
];

export const TOKENS = {
  primary: "#2563eb",
  positive: "#059669",
  negative: "#dc2626",
  warning: "#d97706",
  version: "#7c3aed",
  muted: "#94a3b8",
  grid: "#eef2f7",
};

export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

/** Axis formatter matched to the KPI's unit so ticks stay readable. */
export function axisFormatter(id: KpiId, currency = "USD") {
  const definition = KPI_BY_ID[id];
  return (value: number) => {
    if (!Number.isFinite(value)) return "";
    switch (definition?.group) {
      case "retention":
      case "stability":
      case "progression":
        return `${value.toFixed(0)}%`;
      case "monetization":
        if (id === "impdau") return value.toFixed(1);
        if (id.startsWith("arpdau")) return `${currencySymbol(currency)}${value.toFixed(3)}`;
        if (id === "matchRate" || id === "showRate" || id === "ctr") return `${value.toFixed(0)}%`;
        return `${currencySymbol(currency)}${formatCompactNumber(value)}`;
      default:
        if (id === "playtimePerUserSeconds") return `${Math.round(value / 60)}m`;
        if (id === "sessionsPerUser") return value.toFixed(1);
        return formatCompactNumber(value);
    }
  };
}

/** Exports the first SVG inside `elementId` as a PNG at 2× scale. */
export function exportChartPng(elementId: string, filename: string) {
  const svg = document.getElementById(elementId)?.querySelector("svg");
  if (!svg) return;

  const rect = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" })
  );

  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(2, 2);
    context.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  };
  image.src = url;
}
