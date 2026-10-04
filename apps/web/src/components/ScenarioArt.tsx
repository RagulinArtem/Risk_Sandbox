import type { ReactNode } from "react";

/** Illustrations for scenarios, in the Shock Lens style: charcoal line motifs
 * with a coral accent, and the logo's "shock line" running through the card.
 * Each scenario gets its own motif; unknown ids fall back by category. */

type Motif =
  | "chip"
  | "oil"
  | "ship"
  | "bank"
  | "rate-up"
  | "rate-down"
  | "globe"
  | "virus"
  | "yen"
  | "shield"
  | "credit"
  | "trend-down";

const INK = "#09090B";
const CORAL = "#E53935";

// Line drawings on a 48x48 grid. Coral marks the part that "breaks".
const MOTIFS: Record<Motif, ReactNode> = {
  chip: (
    <>
      <rect x="12" y="12" width="24" height="24" rx="4" stroke={INK} />
      <rect x="18" y="18" width="12" height="12" rx="2" fill={CORAL} stroke="none" />
      {[16, 24, 32].map((p) => (
        <g key={p}>
          <path d={`M${p} 6v6M${p} 36v6M6 ${p}h6M36 ${p}h6`} stroke={INK} />
        </g>
      ))}
    </>
  ),
  oil: (
    <>
      <path d="M24 6c6 9 12 15 12 23a12 12 0 0 1-24 0c0-8 6-14 12-23Z" stroke={INK} />
      <path d="M17 31a7 7 0 0 0 7 7" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  ship: (
    <>
      <path d="M8 30h32l-5 9H13l-5-9Z" stroke={INK} />
      <path d="M16 30V20h14v10M20 20v-6h6v6" stroke={INK} />
      <path d="M4 43c4-3 8-3 12 0s8 3 12 0 8-3 12 0 4 2 4 2" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  bank: (
    <>
      <path d="M6 18 24 7l18 11H6Z" stroke={INK} />
      <path d="M11 22v13M19 22v13M29 22v13M37 22v13M6 39h36" stroke={INK} />
      <path d="M33 13l7 9" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  "rate-up": (
    <>
      <circle cx="15" cy="15" r="5" stroke={INK} />
      <circle cx="33" cy="33" r="5" stroke={INK} />
      <path d="M36 10 12 38" stroke={INK} />
      <path d="M30 8h10v10" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  "rate-down": (
    <>
      <circle cx="15" cy="15" r="5" stroke={INK} />
      <circle cx="33" cy="33" r="5" stroke={INK} />
      <path d="M36 10 12 38" stroke={INK} />
      <path d="M8 30v10h10" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  globe: (
    <>
      <circle cx="24" cy="24" r="16" stroke={INK} />
      <path d="M8 24h32M24 8c-6 5-6 27 0 32M24 8c6 5 6 27 0 32" stroke={INK} />
      <path d="M12 14l8 8 6-4 10 12" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  virus: (
    <>
      <circle cx="24" cy="24" r="10" stroke={INK} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        const x1 = 24 + Math.cos(r) * 10;
        const y1 = 24 + Math.sin(r) * 10;
        const x2 = 24 + Math.cos(r) * 17;
        const y2 = 24 + Math.sin(r) * 17;
        return <path key={a} d={`M${x1} ${y1}L${x2} ${y2}`} stroke={a % 90 === 0 ? CORAL : INK} />;
      })}
    </>
  ),
  yen: (
    <>
      <circle cx="24" cy="24" r="16" stroke={INK} />
      <path d="M17 14l7 10 7-10M24 24v12M18 26h12M18 31h12" stroke={INK} />
      <path d="M34 34l8 8" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  shield: (
    <>
      <path d="M24 6 39 12v11c0 9-6 15-15 19C15 38 9 32 9 23V12l15-6Z" stroke={INK} />
      <path d="M18 18l5 8-4 4 8 8" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  credit: (
    <>
      <rect x="6" y="12" width="36" height="24" rx="4" stroke={INK} />
      <path d="M6 19h36M12 29h8" stroke={INK} />
      <path d="M28 26l6 6m0-6-6 6" stroke={CORAL} strokeWidth="3" />
    </>
  ),
  "trend-down": (
    <>
      <path d="M6 40h36M6 40V8" stroke={INK} />
      <path d="M10 14l9 9 6-5 13 15" stroke={CORAL} strokeWidth="3" />
      <path d="M31 33h7v-7" stroke={CORAL} strokeWidth="3" />
    </>
  ),
};

const BY_ID: Record<string, Motif> = {
  "ai-capex-bust": "chip",
  "semiconductor-supply-shock": "chip",
  "technology-correction": "trend-down",
  "us-export-controls-tightening": "chip",
  "oil-supply-disruption": "oil",
  "strait-of-hormuz-closure": "ship",
  "taiwan-strait-blockade": "ship",
  "china-property-crisis": "globe",
  "global-recession": "globe",
  "interest-rate-shock": "rate-up",
  "us-term-premium-shock": "rate-up",
  "fed-emergency-cut": "rate-down",
  "regional-bank-run": "bank",
  "us-high-yield-credit-event": "credit",
  "historical-gfc-2008": "bank",
  "historical-svb-banking-stress-2023": "bank",
  "historical-covid-crash-2020": "virus",
  "historical-2022-rate-hike-selloff": "rate-up",
  "historical-q4-2018-selloff": "rate-up",
  "historical-yen-carry-unwind-2024": "yen",
  "historical-russia-ukraine-2022": "shield",
  "historical-tariff-shock-2025": "globe",
  "historical-china-devaluation-2015": "yen",
};

const BY_CATEGORY: Record<string, Motif> = {
  macro: "globe",
  rates: "rate-up",
  market: "trend-down",
  credit: "credit",
  geopolitical: "shield",
  sector: "chip",
  "historical-crisis": "trend-down",
  "historical-macro": "rate-up",
  "historical-geopolitical": "shield",
};

// Soft washes, one per motif family, so neighbouring cards differ.
const WASH: Record<Motif, string> = {
  chip: "from-violet-100 to-indigo-50",
  oil: "from-amber-100 to-orange-50",
  ship: "from-cyan-100 to-sky-50",
  bank: "from-slate-200 to-slate-50",
  "rate-up": "from-rose-100 to-orange-50",
  "rate-down": "from-emerald-100 to-teal-50",
  globe: "from-blue-100 to-indigo-50",
  virus: "from-pink-100 to-rose-50",
  yen: "from-red-100 to-rose-50",
  shield: "from-teal-100 to-cyan-50",
  credit: "from-yellow-100 to-amber-50",
  "trend-down": "from-fuchsia-100 to-pink-50",
};

function motifFor(scenarioId: string | undefined, category: string | undefined): Motif {
  return (scenarioId && BY_ID[scenarioId]) || (category && BY_CATEGORY[category]) || "trend-down";
}

function MotifSvg({ motif, className }: { motif: Motif; className: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {MOTIFS[motif]}
    </svg>
  );
}

/** Small square icon (lists, chips). */
export function ScenarioBadge({ scenarioId, category }: { scenarioId?: string; category?: string }) {
  const motif = motifFor(scenarioId, category);
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${WASH[motif]}`}>
      <MotifSvg motif={motif} className="h-6 w-6" />
    </span>
  );
}

/** Card banner illustration. */
export function ScenarioBanner({
  scenarioId,
  category,
  className = "h-28",
}: {
  scenarioId?: string;
  category?: string;
  className?: string;
}) {
  const motif = motifFor(scenarioId, category);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${WASH[motif]} ${className}`}>
      {/* the logo's shock line, echoed across every card */}
      <svg viewBox="0 0 400 112" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M0 70 H150 L175 44 H400" fill="none" stroke={CORAL} strokeOpacity="0.35" strokeWidth="3" />
        <path d="M0 84 H190 L215 58 H400" fill="none" stroke={INK} strokeOpacity="0.08" strokeWidth="3" />
      </svg>
      <MotifSvg motif={motif} className="absolute -right-3 -top-4 h-32 w-32 opacity-[0.13]" />
      <div className="absolute bottom-4 left-5 grid h-12 w-12 place-items-center rounded-2xl bg-white/85 shadow-sm backdrop-blur">
        <MotifSvg motif={motif} className="h-7 w-7" />
      </div>
    </div>
  );
}
