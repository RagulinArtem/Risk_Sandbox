export type SourceStatus = "illustrative" | "verified" | "live";

export interface Scenario {
  id: string;
  title: string;
  category: string;
  description: string;
  source_status: SourceStatus;
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
  horizon: string;
  transmission: string[];
  asset_shocks: Record<string, number>;
}
