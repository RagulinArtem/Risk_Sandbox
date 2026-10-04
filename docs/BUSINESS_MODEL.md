# Business Model

How this project makes money without crippling the free version — and
exactly which parts of the strategy the repo already supports versus
what still has to be built.

## The principle

Give away the part that creates adoption. Charge for the part that
removes operational friction.

This is the Postiz model applied to portfolio risk: the deterministic
engine stays fully open source and genuinely useful self-hosted; the
hosted product sells **convenience, live data, monitoring and managed AI
compute** — not access to the algorithm.

The repo has two properties that make this model credible rather than
aspirational:

1. **Community Edition is already a complete product**, not a demo: it
   runs the full loop — portfolio, risk radar, stress test, contribution
   decomposition, explanations — with zero credentials
   (`AI_PROVIDER=mock` default, no API keys required). Nothing is
   artificially removed to push users to Cloud.
2. **The paid layers are add-ons, not features held back.** Live data,
   managed AI and continuous monitoring are things the Community Edition
   structurally cannot provide (they need infrastructure), so selling
   them doesn't require weakening the free version.

## Community vs Cloud, mapped to this repo

| Capability | Community (free) | Cloud (paid) | In repo today? |
| --- | --- | --- | --- |
| Deterministic stress engine | ✅ | ✅ | ✅ built, unit-tested |
| Scenarios + impact decomposition | ✅ | ✅ | ✅ built |
| Local dashboard | ✅ | ✅ hosted | ✅ built |
| Historical/verified scenarios | ✅ | ✅ | ✅ 2022 benchmark |
| BYOK AI (`AI_PROVIDER=openrouter\|bedrock`) | ✅ | managed | ✅ built |
| BYOK data | ✅ | managed | ⚠️ **one provider is real today** — Polymarket (public, no key). News and institutional sources are documented stubs (`integrations/risk_sources/`), so "managed data integrations" is currently a promise, not a layer. Cloud must build the multi-provider pipeline (Yahoo/Polygon/Finnhub-style price feeds + news), not just host this one. |
| Self-hosting | ✅ `docker-compose up` | — | ✅ built (`docs/DEPLOYMENT.md`) |
| Probability paths (tracked markets) | ✅ | ✅ + more markets | ✅ built |
| Managed AI Risk Committee | BYOK key | no keys, just run it | ✅ built; needs Cloud = managed credits |
| Continuous Risk Radar (pull) | ✅ | ✅ hosted | ✅ built |
| **Continuous monitoring + alerts (push)** | ❌ | ✅ | ❌ not built (biggest Cloud differentiator) |
| **Saved portfolios / run history / comparison** | ❌ | ✅ | ❌ not built (Supabase was cut for the hackathon — see `ROADMAP.md`) |
| **Automatic data/model/scenario updates** | manual | ✅ | ❌ operational work |
| **Premium data tiers** | public sources | verified/institutional feeds | ⬜ architecture already labels data `illustrative → verified → live` |
| **Risk Packs** | community packs | premium packs | ⬜ scenarios are pure JSON — packs are a directory, not a code change |
| **Enterprise** (private deploy, SSO, audit, private LLMs) | — | ✅ | ❌ clearly out of hackathon scope |

Legend: ✅ built · ⬜ structurally enabled, not built · ⚠️ partially real · ❌ not started.

**Read the Cloud rows honestly:** hosting this repo is not the Cloud
product. The Cloud MVP = persistence + monitoring + managed data/AI, and
today the repo contains none of those three as services — it contains the
architecture that makes them add-ons (provider interfaces, provenance
labels, engine/data separation) rather than rewrites.

## Why the labels are also the business model

The data-provenance system built into the engine (`illustrative →
verified → live`, `DEMO/VERIFIED/LIVE/CACHED` badges, `source_name`/
`source_url`/`retrieved_at` on every signal) is not just an integrity
feature — it is the skeleton of the pricing tiers:

- **Free tier:** illustrative AI scenarios + public data (Polymarket,
  user-supplied prices).
- **Premium tier:** verified scenarios, institutional research, premium
  feeds — same engine, better-sourced inputs, every source cited.

Because the engine already refuses to blend unlabeled data, a paid data
tier is a content/credentials change, not a rewrite. The honesty policy
in `AGENTS.md` ("if it isn't sourced, it's illustrative or it doesn't
ship") doubles as a product promise: **premium data is a labeling and
sourcing upgrade, never a "trust us" upgrade.**

## Monetization layers

1. **Cloud subscription (~$15–25/mo)** — hosting, portfolio sync, history,
   managed AI, live radar, notifications, updates. The anchor line:
   *"I don't want to operate my own Bloomberg-like infrastructure."*
2. **Risk-intelligence usage** — the AI Risk Committee has real marginal
   cost (benchmarked ~$0.04/run for 3 analysts + chair; see
   `docs/DECISIONS.md`). Free tier gets a monthly allowance
   (e.g. 20 analyses), Cloud gets more (e.g. 200), beyond that usage
   pricing. The engine math itself stays free and unmetered — only LLM
   compute is metered, which is the honest cost boundary.
3. **Risk Packs** — the "plugins" of this product: a scenario set + mapping
   + sourcing for one theme (Taiwan semiconductor, oil shock, AI bubble,
   crypto, EM banking). Community authors publish free packs; vetted data
   providers sell premium packs; the platform takes a marketplace fee.
   Today's architecture already supports this: scenarios and market
   mappings are JSON files (`data/scenarios/demo/*.json`,
   `data/mapping.json`) — a pack is a directory plus provenance, no code.
4. **Enterprise** — private deployment, internal portfolio data, SSO,
   permissions, audit logs, private LLMs, compliance. Sold on
   integration and governance, not on better math.

## The flywheel

```
open-source engine → developers discover + self-host → contributions
  → better product → more visibility (GitHub/SEO) → more users
  → some choose managed Cloud → revenue funds development
```

The community edition is the distribution. Every README clone, pack
author and self-hoster is a distribution event that costs marketing
nothing.

## Trust is the finance-specific advantage

In consumer tech, open source is distribution. In finance it is also
**verifiability**: anyone can audit exactly how a loss number is
produced. This compounds with the project's core rule — *AI interprets,
code calculates* — and with the number-guard on AI explanations
(`POST /api/ai/explain` rejects any figure that isn't engine output).
A closed competitor can claim determinism; here it can be inspected,
tested and reproduced from the repo. The commercial model and the
engineering philosophy reinforce each other: neither works if the
numbers are a black box.

## What to build, in order (post-hackathon)

1. **Community polish** — what's missing for self-hosters is small: a
   one-command `docker compose up` path (done) and pack documentation
   (todo).
2. **Cloud MVP** — accounts + persistence (portfolios, runs, history,
   replay). The Supabase design was cut from the hackathon but is
   documented; this is the first real Cloud feature because "history and
   comparison over time" is what advisors already pay for.
3. **Continuous monitoring** — scheduled evaluation of tracked markets
   against saved portfolios + alerts. The PRD's "ambient risk radar"
   (ranked by repricing) exists in pull form; push is the Cloud product.
4. **Risk Packs** — define the pack format (JSON schema + directory
   convention), ship the first official pack, open community submission.
5. **Enterprise** — only after 2–3 have paying users; do not build SSO
   for an audience that doesn't exist yet.

## Open decisions (owners: product/strategy)

- [x] **License:** none — all rights reserved (decided 2026-10-04; no LICENSE file, no reuse granted).
- [ ] **Trademark:** the code is all rights reserved, but that does not
      reserve the "Risk Sandbox" name — register the brand separately
      (standard).
- [x] **Contributions:** covered by the all-rights-reserved decision
      (no inbound=outbound note); revisit a CLA/DCO only if the team
      ever relicenses.
- [ ] Pricing validation: advisor seat anchored to comparable tools
      (see `docs/prep/prd.md`); do not finalize before 5 customer
      conversations.
- [ ] What stays permanently free and unmetered (currently: the engine,
      scenario editing, stress tests, local use — recommended to keep).

## Non-goals

- Weakening the Community Edition to force upgrades.
- Paid "better math": the engine is identical in both editions. Paid
  layers add **data quality, monitoring, compute and operations** — all
  labeled as what they are (see `docs/DATA_SOURCES.md`).
- Any feature that would require the AI to invent numbers: the
  `illustrative → verified → live` labeling policy applies to paid data
  exactly as it does today.
