# Roadmap

Status values: `TODO` · `IN PROGRESS` · `BLOCKED` · `DONE`. Owners are
`TBD` until assigned in `docs/TEAM.md` — update both when someone claims a
row.

## Pre-hackathon

### September 30 — Repository foundation

| Priority | Feature | Owner | Status | Acceptance |
| --- | --- | --- | --- | --- |
| P0 | Local + GitHub repository | TBD | DONE | Repo exists, pushed, branch history clean |
| P0 | Architecture documented | TBD | DONE | `docs/ARCHITECTURE.md` matches actual code |
| P0 | Offline MVP (portfolio → radar → scenario → stress test → result) | TBD | DONE | Verified end-to-end in a browser with zero external credentials |
| P0 | 5 demo scenarios | TBD | DONE | `data/scenarios/demo/*.json`, all `source_status: illustrative` |
| P0 | Team onboarding docs | TBD | DONE | `START_HERE.md` + `docs/EDITING_GUIDE.md` exist and match reality |

**Acceptance for the day:** every teammate can `git clone && make setup &&
make dev` and complete a full stress test. Verified true as of this
bootstrap (backend: 32/32 pytest passing, ruff clean; frontend: typecheck
+ lint + build clean; full user flow exercised in a real browser).

### October 1 — Scenario and data validation

| Priority | Feature | Owner | Status | Acceptance |
| --- | --- | --- | --- | --- |
| P0 | Confirm scenario schema | TBD | DONE | `docs/SCENARIO_SCHEMA.md` written, matches `Scenario` Pydantic model |
| P1 | Research institutional scenarios (Fed/IMF) | TBD | DONE | `data/scenarios/demo/historical_2022_rate_hike_selloff.json` — real, cited full-year-2022 returns for all 6 supported assets; see `docs/research/2022-rate-hike-selloff.md` |
| P1 | Investigate Polymarket API | TBD | DONE | Gamma API implemented against its documented response shape (`integrations/risk_sources/polymarket.py`); live-response verification still open — see the Oct 2 row below |
| P1 | Choose one live risk source to pursue | TBD | DONE | Polymarket — see `docs/DECISIONS.md` |
| P0 | Validate demo portfolio | TBD | DONE | Weights sum to 1.0 (enforced by schema + test), produces a visually interesting stress test |

**Acceptance for the day:** at least one future integration
(Polymarket, news, or institutional) has a defined input/output contract
written down, even if unimplemented. Exceeded: Polymarket has a real
implementation (pending live verification) and one scenario is genuinely
`verified`, not just contract-defined.

### October 2 — AI and live-risk integration preparation

| Priority | Feature | Owner | Status | Acceptance |
| --- | --- | --- | --- | --- |
| P1 | Bedrock provider | TBD | IN PROGRESS | Skeleton + graceful-failure path done (`integrations/ai/bedrock.py`); real prompt/response validated against live AWS still open |
| P1 | Polymarket integration | TBD | IN PROGRESS | Implements `RiskSource`, preserves provenance, never fabricates a probability — done and unit-tested (`integrations/risk_sources/polymarket.py`, `ENABLE_POLYMARKET=true`); live-API verification still open (sandbox network policy blocked it during development — see `docs/CURRENT_STATE.md`) |
| P0 | Provenance support | TBD | DONE | `source_status`/`source_name`/`source_url`/`source_date`/`retrieved_at` on every signal schema, and now on `RiskRadarItem` too so the frontend can render it |
| P0 | Live/demo fallback | TBD | DONE | `AI_PROVIDER=mock` default; unconfigured Bedrock raises a caught, user-safe error |

**Acceptance for the day:** the architecture supports live data without
breaking offline mode (already true structurally — verify it stays true
as P1 integrations land).

### October 3 — Demo preparation

| Priority | Feature | Owner | Status | Acceptance |
| --- | --- | --- | --- | --- |
| P0 | UX polish | TBD | TODO | Design review checklist in `docs/DEMO_SCRIPT.md` passes |
| P0 | Test data finalized | TBD | TODO | Demo portfolio + scenarios frozen, no further edits during the hackathon |
| P0 | Scenario storytelling | TBD | TODO | `docs/DEMO_SCRIPT.md` rehearsed end-to-end |
| P0 | Presentation screenshots | TBD | TODO | `docs/screenshots/` updated with final UI |
| P0 | Demo failure fallback | TBD | TODO | Recorded video or static screenshots ready in case of live-demo failure |
| — | **Freeze architecture changes** | — | — | No new services, no new abstractions after today |

**Acceptance for the day:** the full demo can be performed without
internet access.

**Important:** verify iFX Hack Hong Kong 2026's rules on pre-built code
before the event. Do not present work completed before the hackathon
window as having been built during it if event rules require disclosure —
see `docs/HACKATHON_RULES_CHECK.md`.

## Hackathon day — October 4 (Asia/Hong_Kong)

| Time | Block | Goal |
| --- | --- | --- |
| 09:30–10:00 | Team alignment | Confirm pitch, architecture, roles, demo scenario, and what pre-existing code is allowed under event rules |
| 10:00–12:00 | P0 engineering | Risk engine, portfolio input, scenario execution, basic dashboard — a complete, reliable end-to-end flow |
| 12:00–14:00 | Parallel work | Frontend: Risk Radar + result visualization · Risk: scenario logic + decomposition · AI/Data: one real integration · Product: demo story + pitch |
| 14:00–16:00 | Integration | Connect risk signal → scenario → stress engine → dashboard |
| 16:00–17:30 | One differentiator | Pick **one**: Polymarket detection, Bedrock free-text parsing, or historical benchmark comparison. Don't attempt all three unless P0 is rock-solid |
| 17:30–19:00 | Demo polish | Bug fixes, copy, charts, loading/error states |
| 19:00 | **Feature freeze** | No new large functionality — only bug fixes, demo reliability, copy, visual polish |
| 19:00–20:00 | Presentation + rehearsal | Problem, demo, technology, business potential, future roadmap |
| 20:00+ | Final validation | Fresh-environment test if practical; screenshots/video fallback ready |

### Shipped on October 4 (hackathon day build)

| Priority | Feature | Status | Acceptance |
| --- | --- | --- | --- |
| P1 | AI Risk Committee (3 analysts + chair, multi-lab orchestration) | DONE (offline-tested; live pending credits) | Roster hides under mock; engine computes all impacts; guard-railed JSON; fixture tests |
| P1 | Probability paths + tracked markets (`/api/markets/*`) | DONE | Verified live against Gamma/CLOB; 7d/30d pp changes + repriced flag; committed offline snapshot |
| P0 | Factor-betas engine (FR4) + probability-weighted exposure (FR9) | DONE | Golden test reproduces PRD numbers exactly; `beta_version` on results |
| P0 | AI explanation with number guard (FR7) | DONE | Template fallback; numbers must exist in engine output |
| P0 | Friendly provider errors | DONE | 401/402/403/429 mapped to actionable messages; no raw codes on screen |
| P0 | Editable portfolio weights + reset (FR3) | DONE | Sum indicator mirrors backend tolerance; runs guarded while invalid; reset restores the demo portfolio |
| — | Supabase run history (FR13/14) | CUT (per team plan cut order) | Demo never depended on it |

## Post-hackathon — Community & Cloud

The business model is a free, fully functional Community Edition plus a
managed Cloud edition selling convenience, live data, monitoring and AI
compute (never better math). Full mapping to the current architecture and
the open decisions: `docs/BUSINESS_MODEL.md`. Build order:

| Phase | Feature | Status | Acceptance |
| --- | --- | --- | --- |
| 1 | Community self-host polish | IN PROGRESS | `docker compose up` from a clean clone; no LICENSE by team decision (all rights reserved) |
| 2 | Cloud persistence (accounts, saved runs, history, replay) | TODO | The Supabase design in the technical spec is implemented behind `ENABLE_SUPABASE`; demo never depends on it |
| 3 | Continuous monitoring + alerts | TODO | Saved portfolios re-evaluated on a schedule; alerts on repricing/exposure changes |
| 4 | Risk Packs format + first official pack | TODO | A pack is a validated JSON directory (scenario + mapping + sourcing) — no code change to ship one |
| 5 | Premium data tiers | TODO | Verified/institutional sources flow through the existing `illustrative → verified → live` statuses |
| 6 | Enterprise | TODO | Only after phases 2–3 have paying users |

## Priorities

### P0 — must work

Demo portfolio · Risk Radar · scenario selection · editable shocks ·
deterministic stress test · portfolio impact · asset contribution
visualization · explanation · full offline demo.

### P1 — differentiators

One live risk source · free-text scenario parsing · AWS Bedrock ·
Polymarket signal · historical benchmark comparison.

### P2 — only if P0 and P1 are solid

Factor risk model · user authentication · database · automatic portfolio
import · broker integration · advanced probabilistic modeling · automated
hedging recommendations · trade execution.

Do not start P2 before P0 is demo-stable.
