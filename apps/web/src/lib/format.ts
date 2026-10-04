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

export function formatPrice(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
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
