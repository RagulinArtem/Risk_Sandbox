export interface DiversificationResponse {
  portfolio_id: string;
  holdings: number;
  effective_holdings: number;
  effective_drivers: number;
  drivers_for_80pct: number;
  drivers: { share: number; top_holdings: string[] }[];
  window: string;
  source_name: string;
  method: string;
}
