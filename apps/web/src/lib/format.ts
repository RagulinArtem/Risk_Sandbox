export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSignedCurrency(value: number, currency = "USD"): string {
  const formatted = formatCurrency(Math.abs(value), currency);
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatSignedPercent(value: number, digits = 1): string {
  const formatted = formatPercent(Math.abs(value), digits);
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

export function formatSignedPercentagePoints(value: number, digits = 1): string {
  const points = Math.abs(value * 100).toFixed(digits);
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  return `${sign}${points}pp`;
}

export function formatPrice(value: number, currency = "USD"): string {
  // min and max must move together: min 2 / max 0 throws a RangeError
  // (that crashed the BTC drawer, whose price is above $1,000).
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatShortDate(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2h ago", "3d ago", or a date for anything older than a week. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return formatShortDate(iso);
}
