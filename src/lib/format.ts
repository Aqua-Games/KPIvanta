const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
  INR: "₹",
};

export const NA = "N/A";

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  decimals = 0
): string {
  if (isMissing(value)) return NA;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${currencySymbol(currency)}${value.toFixed(decimals)}`;
  }
}

/** Small money values (ARPDAU) need more precision than headline revenue. */
export function formatCurrencyPrecise(
  value: number | null | undefined,
  currency = "USD",
  decimals = 2
): string {
  if (isMissing(value)) return NA;
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.01 ? Math.max(decimals, 4) : decimals;
  return formatCurrency(value, currency, digits);
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (isMissing(value)) return NA;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (isMissing(value)) return NA;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (isMissing(value)) return NA;
  return `${value.toFixed(decimals)}%`;
}

export function formatDecimal(value: number | null | undefined, decimals = 2): string {
  if (isMissing(value)) return NA;
  return value.toFixed(decimals);
}

/** Seconds rendered as "12m 30s" — the unit UA and design teams actually read. */
export function formatMinutes(seconds: number | null | undefined): string {
  if (isMissing(seconds)) return NA;
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }
  return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`;
}

export function formatSignedPercent(value: number | null | undefined, decimals = 1): string {
  if (isMissing(value)) return NA;
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDate(iso: string | undefined, style: "short" | "long" = "short"): string {
  if (!iso) return NA;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: style === "short" ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
