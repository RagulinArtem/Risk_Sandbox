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
