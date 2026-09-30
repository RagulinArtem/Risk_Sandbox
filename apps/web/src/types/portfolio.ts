export interface PortfolioPosition {
  symbol: string;
  weight: number;
}

export interface Portfolio {
  id: string;
  name: string;
  currency: string;
  total_value: number;
  positions: PortfolioPosition[];
}
