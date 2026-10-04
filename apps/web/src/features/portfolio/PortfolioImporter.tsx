import { useRef, useState } from "react";
import { parsePortfolioCsv } from "../../lib/portfolioImport";
import type { Asset, Portfolio } from "../../types";

export function PortfolioImporter({
  portfolio,
  assets,
  onImport,
}: {
  portfolio: Portfolio;
  assets: Record<string, Asset>;
  onImport: (portfolio: Portfolio) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setMessage("Reading portfolio…");
    try {
      const result = await parsePortfolioCsv(file, portfolio, assets);
      onImport(result.portfolio);
      setMessage(
        `${result.portfolio.positions.length} holdings imported locally${
          result.warnings.length ? ` · ${result.warnings.length} skipped` : ""
        }`,
      );
    } catch (caught) {
      setMessage(null);
      setError(caught instanceof Error ? caught.message : "Could not read this CSV.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-accent hover:text-accent-strong"
      >
        Import CSV
      </button>
      <a
        href="data:text/csv;charset=utf-8,symbol%2Cweight%0ASPY%2C35%25%0AQQQ%2C25%25%0ATLT%2C20%25%0AGLD%2C20%25"
        download="risk-copilot-portfolio-template.csv"
        className="text-xs font-medium text-ink-tertiary underline decoration-line-strong underline-offset-2 hover:text-ink"
      >
        template
      </a>
      {message && <span className="text-xs text-risk-positive">{message}</span>}
      {error && <span className="text-xs text-risk-negative-strong">{error}</span>}
    </div>
  );
}
