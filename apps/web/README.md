# Web — apps/web

React + TypeScript + Vite + Tailwind + Recharts dashboard.

## Run

```bash
npm install
npm run dev
```

Opens on http://localhost:5173 and talks to the API at
`VITE_API_BASE_URL` (repo-root `.env`, defaults to `http://localhost:8000`
in code if unset).

## Layout

```
src/
  App.tsx                 Page layout + orchestration (selected scenario,
                           stress-test run state). Kept intentionally thin.
  components/              Small shared, presentational pieces (badges,
                            Section, error/loading states) — no feature logic.
  features/
    dashboard/              Chat-first risk workspace + live factor what-if
    portfolio/              Portfolio summary strip
    risk-radar/              Risk Radar rows
    scenarios/                Scenario workspace: "What if…?" input + editor
    stress-test/               Result headline, contribution chart, explanation
  lib/
    apiClient.ts            Thin fetch wrapper — the only place that knows API URLs
    format.ts               Currency/percent formatting helpers
    portfolioImport.ts      Browser-only CSV portfolio parser (no upload)
  types/                    TypeScript types mirroring apps/api/app/schemas/*
                            exactly (see docs/API_CONTRACT.md). Keep these in
                            sync by hand when the backend schema changes.
```

Business math (stress-test calculations) is never done in the frontend —
it only renders what the API returns.

The Home workspace uses the backend factor/scenario engines for every displayed
impact. CSV imports are parsed locally and remain session-only; they are not
uploaded or presented as a connected brokerage account.

## Check

```bash
npm run typecheck
npm run lint
npm run build
```
