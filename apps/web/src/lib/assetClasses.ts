// Display labels and chart colors for the asset classes in
// data/assets/supported_assets.json. Presentation only — no risk math here.
export const ASSET_CLASS_LABEL: Record<string, string> = {
  equity: "Single stock",
  equity_etf: "Equity ETF",
  crypto: "Crypto",
  bond_etf: "Bonds",
  commodity_etf: "Commodities",
};

// One hue per holding, ordered so neighbours in the donut stay distinct.
export const HOLDING_COLORS = ["#5C8AC7", "#8C7BD6", "#4FA3A5", "#C48A32", "#7A9B4A", "#B5677E"];

export function assetClassLabel(assetClass: string): string {
  return ASSET_CLASS_LABEL[assetClass] ?? assetClass;
}
