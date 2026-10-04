// Display labels and chart colors for the asset classes in
// data/assets/supported_assets.json. Presentation only — no risk math here.
export const ASSET_CLASS_LABEL: Record<string, string> = {
  equity: "Single stock",
  equity_etf: "Equity ETF",
  crypto: "Crypto",
  bond_etf: "Bonds",
  commodity_etf: "Commodities",
  real_estate_etf: "Real estate",
  cash_etf: "Cash-like",
};

// One hue per holding (up to 15), ordered so neighbours in the donut stay
// distinct: alternating hue families, muted to sit on the dark surface.
export const HOLDING_COLORS = [
  "#5C8AC7", "#C48A32", "#4FA3A5", "#B5677E", "#7A9B4A",
  "#8C7BD6", "#C46A4A", "#5FA37A", "#A88FD0", "#C9A94F",
  "#4F7FA3", "#D08C9F", "#8AA34F", "#7FA8C9", "#A3794F",
];

export function assetClassLabel(assetClass: string): string {
  return ASSET_CLASS_LABEL[assetClass] ?? assetClass;
}

/** Stable color per holding (largest weight first), shared by every chart. */
export function holdingColors(positions: { symbol: string; weight: number }[]): Record<string, string> {
  return Object.fromEntries(
    [...positions]
      .sort((a, b) => b.weight - a.weight)
      .map((p, i) => [p.symbol, HOLDING_COLORS[i % HOLDING_COLORS.length]]),
  );
}
