import { formatCompactNumber, formatCurrency, formatPercent, formatRoas } from "@/lib/format";

export const SERIES_COLORS = {
  spend: "#2563eb",
  adRevenue: "#059669",
  iapRevenue: "#0891b2",
  totalRevenue: "#0f172a",
  subscriptionRevenue: "#7c3aed",
  roasTotal: "#2563eb",
  roasAd: "#059669",
  roasIap: "#0891b2",
  roasPlatform: "#d97706",
  target: "#94a3b8",
  profit: "#059669",
  loss: "#dc2626",
  version: "#7c3aed",
} as const;

export type MetricFormat = "currency" | "compact" | "percent" | "roas" | "decimal";

export function formatByType(
  value: number | null | undefined,
  type: MetricFormat,
  currency = "USD"
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  switch (type) {
    case "currency":
      return formatCurrency(value, currency, value < 100 ? 2 : 0);
    case "compact":
      return formatCompactNumber(value);
    case "percent":
      return formatPercent(value);
    case "roas":
      return formatRoas(value);
    case "decimal":
      return value.toFixed(2);
  }
}

export function axisTickFormatter(type: MetricFormat, currency = "USD") {
  return (value: number) => {
    if (type === "currency") {
      const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
      return `${symbol}${formatCompactNumber(value)}`;
    }
    if (type === "percent") return `${value.toFixed(0)}%`;
    if (type === "roas") return `${value.toFixed(1)}x`;
    return formatCompactNumber(value);
  };
}

export function downloadChartPng(elementId: string, filename: string) {
  const container = document.getElementById(elementId);
  const svg = container?.querySelector("svg");
  if (!svg) return;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    ctx.drawImage(image, 0, 0);
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
