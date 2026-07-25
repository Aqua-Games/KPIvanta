const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
  CAD: "$",
  AUD: "$",
};

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  decimals = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(value);
  } catch {
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
    return `${symbol}${value.toFixed(decimals)}`;
  }
}

export function formatCurrencyPrecise(
  value: number | null | undefined,
  currency = "USD"
): string {
  return formatCurrency(value, currency, 2);
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(decimals)}%`;
}

export function formatRoas(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(2)}x`;
}

export function formatDecimal(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return value.toFixed(decimals);
}

export function formatDate(iso: string | undefined, style: "short" | "long" = "short"): string {
  if (!iso) return "N/A";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: style === "short" ? "short" : "long",
    day: "numeric",
    year: "numeric",
  });
}

export function signed(value: number | null | undefined, formatter: (v: number) => string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatter(value)}`;
}
