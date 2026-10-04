import { type ReactNode, useEffect, useRef, useState } from "react";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { LoadingLine } from "../../components/LoadingLine";
import { api } from "../../lib/apiClient";
import { assetClassLabel } from "../../lib/assetClasses";
import {
  formatCurrency,
  formatPercent,
  formatPrice,
  formatRelativeTime,
  formatShortDate,
  formatSignedPercent,
} from "../../lib/format";
import type { Asset, Portfolio, PriceRange } from "../../types";
import { RANGES } from "../portfolio/priceRanges";
import { AssetPriceChart } from "./AssetPriceChart";
import { MoveDrivers } from "./MoveDrivers";
import { PastEpisodes } from "./PastEpisodes";
import { useAssetNews, useAssetPrices } from "./useAssetData";

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line px-5 py-5">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">{title}</h3>
      {children}
    </section>
  );
}

function Signed({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-tertiary">—</span>;
  return (
    <span className={value >= 0 ? "text-risk-positive" : "text-risk-negative-strong"}>
      {formatSignedPercent(value)}
    </span>
  );
}

function PriceBlock({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<PriceRange>("1y");
  const { data, error, loading } = useAssetPrices(symbol, range);

  if (error && !data) {
    return (
      <div className="border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-tertiary">
        Price data unavailable. Everything else about this asset still works.
      </div>
    );
  }
  if (!data) return <LoadingLine label="Loading real prices…" />;

  return (
    <div className={`space-y-4 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
            Latest available close · {formatShortDate(data.latest_close_date)}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-2xl tabular-nums text-ink">{formatPrice(data.latest_close)}</span>
            <span className="font-mono text-sm tabular-nums">
              <Signed value={data.day_change_pct} /> <span className="text-ink-tertiary">1D</span>
            </span>
          </div>
        </div>
        <div role="group" aria-label="Chart range" className="inline-flex border border-line-strong">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={r.id === range}
              onClick={() => setRange(r.id)}
              className={`px-2 py-1 font-mono text-[11px] ${
                r.id === range ? "bg-accent/15 text-accent-strong" : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <AssetPriceChart prices={data} />

      <dl className="grid grid-cols-3 gap-px border border-line bg-line sm:grid-cols-6">
        {data.returns.map((r) => (
          <div key={r.period} className="bg-surface px-2 py-2 text-center" title={r.from_date ? `vs close on ${r.from_date}` : "Not enough history"}>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">{r.period}</dt>
            <dd className="mt-0.5 font-mono text-xs tabular-nums">
              <Signed value={r.return_pct} />
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-[11px] text-ink-tertiary">
        <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-strong underline decoration-accent/40 underline-offset-2">
          {data.source_name} ↗
        </a>{" "}
        · {data.price_field}, returns include dividends · retrieved{" "}
        {new Date(data.retrieved_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.
        Not a live quote.
      </p>
    </div>
  );
}

function NewsBlock({ symbol }: { symbol: string }) {
  const { data, error, loading } = useAssetNews(symbol);
  if (loading) return <LoadingLine label="Loading headlines…" />;
  if (error || !data) return <p className="text-sm text-ink-tertiary">Recent news unavailable.</p>;
  if (data.items.length === 0) return <p className="text-sm text-ink-tertiary">No recent headlines found for {symbol}.</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {data.items.map((item) => (
          <li key={item.id} className="py-2.5 first:pt-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
              {formatRelativeTime(item.published_at)} · {item.publisher}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm leading-snug text-ink hover:text-accent-strong"
            >
              {item.headline} <span className="text-ink-tertiary">↗</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-tertiary">
        Headlines via {data.source_name}, shown as published. Links open the original source.
      </p>
    </div>
  );
}

export function AssetDrawer({
  symbol,
  portfolio,
  isLiveAi,
  onClose,
}: {
  symbol: string;
  portfolio: Portfolio;
  isLiveAi: boolean;
  onClose: () => void;
}) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    setAssetError(null);
    api
      .getAsset(symbol)
      .then((a) => !cancelled && setAsset(a))
      .catch(() => !cancelled && setAssetError("Couldn't load this asset."));
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const position = portfolio.positions.find((p) => p.symbol === symbol);

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label={`${symbol} details`}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line-strong bg-surface shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-xl font-semibold text-ink">{symbol}</div>
              <div className="truncate text-sm text-ink-secondary">{asset?.name ?? " "}</div>
              {asset && (
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-ink-tertiary">
                  <span className="border border-line-strong px-1.5 py-px font-mono uppercase tracking-wider text-ink-secondary">
                    {asset.instrument}
                  </span>
                  <span>{assetClassLabel(asset.asset_class)}</span>
                  <span>·</span>
                  <span>{asset.category}</span>
                  <span>·</span>
                  <span>{asset.region}</span>
                </div>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="shrink-0 border border-line-strong px-2.5 py-1 text-sm text-ink-secondary hover:border-accent hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
            >
              Close
            </button>
          </div>
          {position && (
            <div className="mt-4 flex gap-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">Portfolio weight</div>
                <div className="font-mono text-lg tabular-nums text-ink">{formatPercent(position.weight, 1)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">Position value</div>
                <div className="font-mono text-lg tabular-nums text-ink">
                  {formatCurrency(position.weight * portfolio.total_value, portfolio.currency)}
                </div>
              </div>
            </div>
          )}
        </header>

        {assetError && (
          <div className="p-5">
            <ErrorBanner message={assetError} />
          </div>
        )}

        <DrawerSection title="Performance">
          <ErrorBoundary
            resetKey={symbol}
            fallback={<p className="text-sm text-ink-tertiary">Price section failed to display.</p>}
          >
            <PriceBlock symbol={symbol} />
          </ErrorBoundary>
        </DrawerSection>

        {asset && (
          <>
            <DrawerSection title="What is this?">
              <p className="text-sm leading-relaxed text-ink">{asset.description}</p>
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
                  Role in this portfolio
                </div>
                <p className="text-sm leading-relaxed text-ink-secondary">{asset.portfolio_role}</p>
              </div>
            </DrawerSection>

            <DrawerSection title="Key risk factors">
              <ul className="flex flex-wrap gap-2">
                {asset.risk_factors.map((f) => (
                  <li
                    key={f}
                    className="border border-risk-warning/30 bg-risk-warning/5 px-2 py-1 text-xs text-ink-secondary"
                  >
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-ink-tertiary">
                Test any of these against the whole portfolio in the Stress Test tab, e.g. with
                &ldquo;What if…?&rdquo;.
              </p>
            </DrawerSection>
          </>
        )}

        <DrawerSection title="In past stress episodes">
          <PastEpisodes symbol={symbol} />
        </DrawerSection>

        {isLiveAi && (
          <DrawerSection title="What may be driving the recent move?">
            <MoveDrivers symbol={symbol} />
          </DrawerSection>
        )}

        <DrawerSection title="Latest news">
          <NewsBlock symbol={symbol} />
        </DrawerSection>

        <p className="mt-auto border-t border-line px-5 py-4 text-[11px] text-ink-tertiary">
          Description, role and risk factors are static reference notes. Prices and headlines come
          from {"Yahoo Finance"}. AI sections are interpretation. Nothing here is investment advice.
        </p>
      </aside>
    </div>
  );
}
