\# AI Portfolio Risk Copilot: PRD

Oct 4, 2026 · @Alessandro Rossi

\#\# Overview

AI Portfolio Risk Copilot turns prediction-market probability paths into a traceable stress test of a user's portfolio, explained in plain English.

\*\*Goal.\*\* Reach the top 7 at iFX Hack Hong Kong 2026 (4 Oct, HKU) and the Grand Final on 8 Oct at HKCEC. Scoring is out of 100: Does it work 35, Is it worth building 35, Can you pitch it 15, Is it clever 15\. The pitch is 3 minutes plus 2 minutes of Q\&A.

\*\*Hero loop (the only thing we demo):\*\*

1\. A real prediction-market probability path is shown, with a flag when it has repriced.  
2\. The market maps to a stress scenario (asset shocks).  
3\. The deterministic engine applies the shocks to the user's portfolio.  
4\. The result shows impact, stressed value and which holding drives the loss.  
5\. A plain-English explanation covers why it matters, using only the engine's numbers.

\*\*Principle.\*\* The AI interprets and explains; a deterministic engine calculates. We show exposure to a scenario. We do not predict prices or recommend trades.

\*\*Not building.\*\* News ingestion, push alerts, buy/sell recommendations, a trading bot, extra scenarios beyond the headline one, user accounts and login.

\#\# Users and problem

Retail investors are the users; advisors and platforms are the customers who pay.

\*\*The user (Anna).\*\* A retail investor who holds a few stocks or funds she picked herself. A headline says chip supply is at risk or rates will stay high, and she cannot tell whether it matters for what she owns, so she holds, panics or ignores it. Professional risk tools exist but are priced and built for institutions.

\*\*What we give her.\*\* A plain-English answer to "what could this mean for my portfolio, and why?" We never say when to buy or sell.

| Segment | Role | Why they would pay | Status |  
| \--- | \--- | \--- | \--- |  
| Advisors, private bank RMs, family office teams | First paying customer | Answer client questions fast with a traceable, documentable number | Hypothesis to test |  
| Brokers, banks' retail wealth arms, investing apps | Scale channel | Engagement and trust; fewer panic decisions | Unvalidated; roadmap only |  
| Retail investors | End user | Free to them, paid for by the platform | Do not claim they pay |

\*\*Market context (sourced).\*\* Hong Kong asset management reached HK$42.2trillionin2025,withprivatebankingandwealthmanagementatHK$12.9 trillion. There are 2,358 licensed Type 9 asset managers with 15,747 licensed individuals, a loose upper bound since many are fund managers rather than client-facing advisors (\[Hubbis, SFC 2025 survey\](https\://hubbis.com/news/hong-kong-s-aum-grew-20-to-a-record-high-sfc-s-2025-survey-on-asset-and-wealth-management)). Hong Kong had more than 3,380 single-family offices at end-2025 (\[news.gov.hk, Deloitte study\](https\://www\.news.gov.hk/eng/2026/02/20260210/20260210\_141730\_607.html)). Not yet sourced: the number of Hong Kong retail investors and what platforms pay for analytics; do not quote either.

\*\*Pricing anchor (assumption).\*\* Advisor seat near the \\\~\$250/month listed for Nitrogen (\[Capterra\](https\://www\.capterra.com/p/210418/Riskalyze/)), versus a Bloomberg Terminal at roughly \$32,000 per year at list price (\[Costbench\](https\://costbench.com/software/financial-data-terminals/bloomberg-terminal/)). Platform pricing is per active user, to be validated with partners.

\#\# Competitive edges

Four of the five edges coexist in the build; the fifth only in a small, real form. The core edge is prediction-market probability paths.

\*\*Competitive reality.\*\* "AI explains portfolio risk" is not novel: Bloomberg launched AI Portfolio Commentary in PORT Enterprise (\[Bloomberg press release\](https\://www\.bloomberg.com/company/press/bloomberg-advances-portfolio-analytics-with-launch-of-ai-portfolio-commentary-in-port-enterprise)). The team's research also says MSCI RiskMetrics offers risk reporting for individual investors (not independently verified). Nitrogen sells risk and stress testing to advisors. So the pitch cannot be "Bloomberg for retail" or "Bloomberg is expensive".

| Edge | Role in the product | What we build | Limit |  
| \--- | \--- | \--- | \--- |  
| A. Prediction markets as the risk signal | Core | Live Polymarket odds for 1-3 mapped markets | Needs a liquid market that maps to asset shocks; verify live first |  
| B. Probability path, not snapshot | Core, the hero visual | Price-history sparkline with a "repriced" flag over 7 and 30 days | Real data only; no hand-drawn curves |  
| C. Plain English to structured scenario | Table stakes, built but not sold as the edge | Bedrock turns text into schema-validated assumptions and shows the transmission chain | Easy to copy; its value is the visible chain |  
| D. Retail-first explanation | Positioning | Plain-English wording in the explanation and pitch | No build time |  
| E. Ambient risk radar | Minimal real version | A list of tracked markets ranked by recent repricing, computed from real data | No push alerts, no "agent noticed" claims |

\*\*Why B wins.\*\* Bloomberg's risk signals come from financial instruments and models. Prediction markets price discrete event outcomes, a different signal class. Two markets can both show 83%, but one drifted there and the other repriced sharply; the second carries more information. A path is that difference.

\*\*Answers to rehearse.\*\*

\- Why not ChatGPT? The AI never does the math, so the same scenario always gives the same traceable result.  
\- Why not Bloomberg? "Bloomberg's risk models price financial instruments. We price event expectations and how they are moving, and map that path to what you own." Do not argue on cost alone.  
\- Why not Nitrogen? Verify what Nitrogen does today before claiming a difference. Our candidate line: we start from live event expectations rather than a client questionnaire.

\*\*Demo numbers.\*\* Any figure such as "8% to 23% in six days" must come from the real market on the day. Illustrative numbers are labelled DEMO on screen.

\#\# Scope

We ship one loop that works end to end, and cut anything that is not on the demo path. Pre-built code is allowed; we disclose it in one line in the pitch.

\*\*In scope\*\*

\- One headline scenario, chosen from whichever mapped Polymarket market has a real, liquid, interesting path.  
\- 1-3 tracked markets, with probability path and repricing flag.  
\- Demo portfolio ("Anna", technology-heavy) over SPY, QQQ, NVDA, BTC, GLD and TLT, with editable weights. TSMC appears in the vision doc's example but is not in this universe: add it or drop it from the story.  
\- Deterministic stress engine, per-asset contribution, probability-weighted exposure.  
\- Bedrock scenario parsing and explanation, with rule-based fallback.  
\- Minimal radar list ranked by recent repricing.

\* Supabase run history, best effort and never on the demo path: saved runs and portfolios, and a replay view if time allows.

\*\*Out of scope\*\*

\- News ingestion and institutional-report ingestion.  
\- Push alerts or any claim that an agent monitors continuously.  
\- More than the headline scenario plus one or two presets.  
\- Buy/sell recommendations and hedge advice.  
\- Further Docker, Makefile or docs work.

\* User accounts, login, or any direct browser access to Supabase.

\*\*Scenario choice rule.\*\* The data picks the scenario, not the other way round. Prefer a rates, oil, recession or tech scenario if it has the better market; use a chip-supply or Taiwan framing only if its market is liquid and the path is real.

\#\# Functional requirements

Fourteen requirements; the P0 items are the demo, and nothing P1 starts until all P0 items work.

| ID | Requirement | Priority | Owner |  
| \--- | \--- | \--- | \--- |  
| FR1 | Probability path: fetch price history for 1-3 mapped Polymarket markets; draw a sparkline with 7-day and 30-day change and a "repriced" flag when the move exceeds a set threshold (value to decide with real data) | P0 | Frontend \+ backend |  
| FR2 | Market-to-scenario mapping: a curated table linking each tracked market to a scenario and factor shocks | P0 | Backend |  
| FR3 | Portfolio: demo portfolio (Anna) with editable weights over the six assets | P0 | Frontend |  
| FR4 | Stress engine: deterministic, shocks times betas, per-asset contribution, same input gives same output | P0 | Backend |  
| FR5 | Results view: portfolio impact %, stressed value, contribution chart, DEMO / VERIFIED / LIVE labels on every number | P0 | Frontend |  
| FR6 | Plain-English scenario input: Bedrock converts text to schema-validated JSON assumptions, editable by the user, with a rule-based fallback | P0 | Backend |  
| FR7 | Explanation: plain-English "why this matters" that uses only numbers from the engine output | P0 | Backend |  
| FR8 | Backup demo video and real-vs-mocked list, done at feature freeze | P0 | Strategy |  
| FR9 | Probability-weighted exposure: market probability times stressed loss, per scenario | P1 | Backend |  
| FR10 | Minimal radar: tracked markets ranked by recent repricing, from real data, no push alerts | P1 | Frontend |  
| FR11 | Reduce-position what-if: show how the loss changes if a holding is trimmed; no trade recommendations | P1 | Backend |  
| FR12 | Verified historical benchmark (2022 asset returns) shown beside the scenario | P2 | Backend |  
| FR13 | Save runs: store every stress run in Supabase (inputs, result, betas version, AI status, explanation) without blocking the response; skipped silently if Supabase is unavailable; cut at about 17:00 if not working (details in the Technical spec tab) | P1 | Backend |  
| FR14 | History and replay: a History panel listing recent runs, with a Replay button that reruns the engine on the stored inputs and shows an identical result | P2 | Frontend \+ backend |

Owners are proposals: swap in names at the team sync.

\#\# Data and risk engine

The engine is plain arithmetic over cached, labelled data, so every number can be traced.

\*\*Probability data.\*\* Polymarket documents a price-history endpoint (\[docs\](https\://docs.polymarket.com/cn/api-reference/endpoints/clob/get-prices-history)). The repo's Polymarket integration is implemented and unit-tested but not verified against the live API, so verifying it is gate 1\. Filter to liquid markets; thin markets give noisy paths. If the live call fails, use a cached snapshot labelled with its timestamp and stop calling it live.

\*\*Mapping table.\*\* One row per tracked market: market id, question text, scenario name, factor shocks, and the source of each shock (a historical analogue or published study). The mapping is curated by the team, not discovered by AI, and the pitch says so.

\*\*Betas.\*\* Compute each asset's sensitivity to the scenario factors (oil, Nasdaq, rates, USD) from 2-3 years of daily returns, cache the result as CSV, and commit the script that produced it. Betas are historical averages, not forecasts; state that in the UI.

\*\*Stress calculation.\*\* For asset i with weight w, factor betas and scenario shocks s:

\`\`\`latex  
\\Delta P \= \\sum\_i w\_i \\sum\_f \\beta\_{i,f}\\, s\_f  
\`\`\`

\*\*Probability-weighted exposure.\*\* With market probability p (the market's current price, treated as a rough crowd estimate):

\`\`\`latex  
E \= p \\times \\Delta P  
\`\`\`

\*\*Outputs.\*\* Portfolio impact %, stressed portfolio value, per-asset contribution (share of the total loss), and the exposure figure E. Every output carries a DEMO, VERIFIED or LIVE label.

\*\*Run history (optional).\*\* If Supabase is enabled, each run is saved with its inputs, result, betas version and AI status so it can be replayed. The engine itself never reads from or writes to the database, and a Supabase failure never changes a result.

\#\# AI layer

The AI does two jobs through Amazon Bedrock, and neither involves doing the math.

\*\*Call 1: scenario parsing (FR6).\*\* Input is the user's text, such as "what if oil rises 40% and Nasdaq falls 15%?". Output is JSON with a scenario name, a list of factor shocks (factor and percent), and a short rationale. The backend validates it against a schema, rejects unknown factors, clamps extreme values, and shows the assumptions to the user for editing before anything runs. The existing rule-based parser stays as the fallback when Bedrock fails or returns invalid JSON.

\*\*Call 2: explanation (FR7).\*\* Input is the engine's output JSON only. The prompt requires that the model uses only the numbers provided, writes for someone with no finance background, names the largest contributor, states that results depend on historical betas and the scenario assumptions, and gives no buy, sell or timing advice. Test the output on a non-finance reader before the demo.

\*\*Rules that make this defensible.\*\*

\- The same scenario always gives the same engine result; only the wording may vary.  
\- If the explanation contains a number that is not in the engine output, the build is wrong.  
\- Which Bedrock model and any AWS credits are still unknown: ask the organizers.

\*\*Failure behaviour.\*\* On a Bedrock error, show the rule-based result with a visible "AI unavailable, using rules" label rather than hiding it.

\#\# Demo flow and pitch

Half the 3 minutes is the live demo, in this order: path first, explanation last.

\*\*Click script (headline scenario to be filled once chosen):\*\*

1\. Open the dashboard with Anna's portfolio and its DEMO label.  
2\. Show the radar list of tracked markets, ranked by recent repricing.  
3\. Open the headline market and show its probability path and the repricing flag.  
4\. Show the mapped scenario and its assumptions; edit one value to prove it is live.  
5\. Run the stress test.  
6\. Read the result: portfolio impact, stressed value, the holding that drives the loss.  
7\. Show probability-weighted exposure.  
8\. Show the plain-English explanation and point out it only uses engine numbers.  
9\. Type a free-text scenario to show Bedrock parsing the input.

Optional, only if FR14 is built: open the History panel and replay the run to show an identical result.

| Time | Section | Content |  
| \--- | \--- | \--- |  
| 0:00-0:30 | Problem | Anna sees a scary headline and cannot tell whether it matters to her holdings |  
| 0:30-2:15 | Demo | Steps 3-8 above, saying out loud what is real and what is mocked |  
| 2:15-2:45 | Business | Retail is the user; advisors first, platforms later pay |  
| 2:45-3:00 | Next | More markets, continuous monitoring, platform integrations; one line on 5-7 Oct if we reach the final |

One disclosure line near the start: the engine was scaffolded before the event; today we built the parts listed in the real-vs-mocked table.

\*\*Real versus mocked\*\* (fill in at feature freeze; anything not marked real is said out loud):

| Component | Status |  
| \--- | \--- |  
| Polymarket odds and path | To confirm: live or cached |  
| Betas | To confirm: computed from real returns or illustrative |  
| Bedrock parsing and explanation | To confirm |  
| Stress engine | Real, deterministic |  
| Demo portfolio | Demo data |  
| Run history (Supabase) | To confirm: saving live, or switched off |

Backup: a short recorded video of the full working flow, made at feature freeze.

\#\# Success criteria

Seventy of the 100 points come from working software and a believable business case, so those get the build time.

| Criterion | Weight | What we must show | Evidence |  
| \--- | \--- | \--- | \--- |  
| Does it work? | 35 | The full loop runs live, with no dead buttons and no faked numbers | Live demo, plus a backup video |  
| Is it worth building? | 35 | A named user, a named paying customer, a reason they would pay, and an honest answer on competitors | Customer table, pricing anchor, competitor answers |  
| Can you pitch it? | 15 | Problem, solution, user and next step in 3 minutes, with an honest real-versus-mocked statement | Rehearsed pitch, 5 timed runs |  
| Is it clever? | 15 | The probability-path idea, shown on real data | Sparkline with a real repricing event |

The judging weights and pitch format come from the organizers' briefing. The rubric's own wording is that faked features and dead buttons score low, and a live working demo beats a slideshow.

\*\*Likely Q\&A, answers prepared in advance:\*\* why not ChatGPT, why not Bloomberg, why not Nitrogen, who pays, is this investment advice, what is real and what is mocked, what happens when the market is wrong. The honest answer to "is this investment advice" is no: we show exposure to a scenario and recommend no trades, and we would take regulatory advice before launching in any market.

\#\# Risks, timeline and open decisions

The biggest risk is that the Polymarket path does not work live; everything else has a fallback.

| Risk | Fallback |  
| \--- | \--- |  
| Polymarket call fails or has no good market | Labelled cached snapshot; stop saying "live"; choose the scenario from a market that works |  
| Bedrock fails or returns bad JSON | Rule-based parser with a visible label |  
| Judges say "just a prediction-market dashboard" | Tie every signal to a stress result and show the math |  
| Numbers look faked | Real betas from cached returns; every number labelled DEMO, VERIFIED or LIVE |  
| Scope creep | Nothing P1 starts before every P0 works |  
| Q\&A on Bloomberg or Nitrogen | Rehearsed answers; verify Nitrogen's current features first |  
| Supabase down, slow or unreachable, or setup eats build time | Runs still return normally with no run id; rows queue locally; History shows unavailable; cut Supabase at about 17:00 if it is not saving rows |

\*\*Timeline.\*\* The event runs 09:30-21:00 HKT. Adjust if the team is behind.

| By | Gate | Done when |  
| \--- | \--- | \--- |  
| \\\~11:30 | Gate 1 | One real Polymarket path is drawn; headline scenario chosen; click script written; buyer wording agreed |  
| \\\~15:00 | Gate 2 | The full loop runs end to end, even if ugly; real betas in place |  
| 15:00-18:00 | Build | Bedrock parsing and explanation, probability-weighted exposure, polish |  
| \\\~17:00 | Supabase cut line | Every run saves a row, or Supabase is cut; the demo does not depend on it |  
| \\\~18:30 | Freeze | No new features; backup video recorded; real-versus-mocked table filled in |  
| After 18:30 | Rehearse | At least 5 timed pitch runs, including Q\&A |

\*\*Open decisions\*\*

\- \[ \] Headline scenario, driven by which mapped market has a real, liquid path  
\- \[ \] Buyer wording in the pitch: retail user, advisor first, platforms later  
\- \[ \] Owners for backend, frontend and strategy  
\- \[ \] Repricing flag threshold, set once real data is in  
\- \[ \] AWS credits and Bedrock model, asked of the organizers  
\- \[ \] Verify what Nitrogen offers today before using the differentiation line

\* \[ \] Supabase: who creates the project and keys, and whether to keep it past the 17:00 cut line

