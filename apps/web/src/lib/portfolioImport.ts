import type { Asset, Portfolio, PortfolioPosition } from "../types";

export interface PortfolioImportResult {
  portfolio: Portfolio;
  warnings: string[];
}

function splitRow(row: string, delimiter: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  cells.push(value.trim());
  return cells;
}

function numberFromCell(value: string) {
  const parsed = Number(value.replace(/[$,%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse a small retail-friendly CSV without uploading the file anywhere.
 * Accepted columns: symbol/ticker plus weight/weight_pct/allocation or value/market_value. */
export async function parsePortfolioCsv(
  file: File,
  current: Portfolio,
  assets: Record<string, Asset>,
): Promise<PortfolioImportResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV needs a header and at least one holding.");

  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const header = splitRow(lines[0], delimiter).map((cell) => cell.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const symbolIndex = header.findIndex((cell) => ["symbol", "ticker", "asset"].includes(cell));
  const weightIndex = header.findIndex((cell) => ["weight", "weight_pct", "allocation", "allocation_pct", "percent"].includes(cell));
  const valueIndex = header.findIndex((cell) => ["value", "market_value", "amount"].includes(cell));
  if (symbolIndex < 0 || (weightIndex < 0 && valueIndex < 0)) {
    throw new Error("Use columns symbol + weight (or symbol + value). Example: SPY,35%.");
  }

  const warnings: string[] = [];
  const raw = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const cells = splitRow(line, delimiter);
    const symbol = (cells[symbolIndex] ?? "").trim().toUpperCase();
    if (!symbol) continue;
    if (Object.keys(assets).length > 0 && !assets[symbol]) {
      warnings.push(`${symbol} was skipped because the demo risk engine has no asset metadata for it.`);
      continue;
    }
    const sourceIndex = weightIndex >= 0 ? weightIndex : valueIndex;
    const parsed = numberFromCell(cells[sourceIndex] ?? "");
    if (parsed === null || parsed < 0) {
      warnings.push(`${symbol} was skipped because its allocation is invalid.`);
      continue;
    }
    raw.set(symbol, (raw.get(symbol) ?? 0) + parsed);
  }

  if (raw.size === 0) throw new Error("No supported holdings were found in this CSV.");
  const total = [...raw.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("Portfolio allocation must be greater than zero.");

  const positions: PortfolioPosition[] = [...raw.entries()]
    .map(([symbol, value]) => ({ symbol, weight: value / total }))
    .sort((a, b) => b.weight - a.weight);
  const importedValue = valueIndex >= 0 ? total : current.total_value;

  return {
    portfolio: {
      ...current,
      id: `imported-${Date.now()}`,
      name: file.name.replace(/\.csv$/i, "") || "Imported portfolio",
      total_value: importedValue,
      positions,
    },
    warnings,
  };
}
