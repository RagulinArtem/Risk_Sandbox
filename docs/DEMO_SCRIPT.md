# Demo Script

Target: 2–3 minutes. Practice it — the flow below assumes `make dev` is
already running and the browser is already open to http://localhost:5173.

## 1. Hook (15s)

> "Most investors see thousands of risk headlines and have no way to know
> which ones actually matter to *their* portfolio."

## 2. Show the portfolio (15s)

Point at the portfolio summary strip: value, position count, largest
position (NVDA, 30%), concentration flag.

> "This is a technology-heavy demo portfolio — concentrated, which makes
> it genuinely exposed to the risks we're about to look at."

## 3. Show the Risk Radar (20s)

Scroll through the five cards.

> "Each of these is a risk scenario, scored for relevance to *this*
> specific portfolio — not a generic news feed."

## 4. Select Semiconductor Supply Shock (15s)

Click **Stress Test** on that card.

> "This one's flagged high relevance because we're heavily weighted toward
> NVDA and QQQ."

## 5. Explain the transmission mechanism (20s)

Point at the transmission chain in the scenario workspace.

> "Before we run anything, you can see *how* this risk is assumed to
> propagate — supply disruption, chip availability, production
> expectations, valuations. And every assumption here is editable."

## 6. Run the stress test (10s)

Click **Run Stress Test**.

## 7. Show the estimated loss (15s)

Point at the headline number.

> "Estimated impact: about -11.5%, roughly $11,500 on a $100,000
> portfolio. This is a stress-test estimate against an illustrative
> scenario — not a forecast."

## 8. Show which holdings contribute most (20s)

Point at the contribution chart and "Largest Downside Contributor."

> "NVDA alone accounts for about two-thirds of that. That's the
> concentration risk made concrete."

## 9. Show the explanation (10s)

Point at "Why This Matters."

> "This explanation is deterministic — rule-based Python, not an LLM
> guessing. We label it that way on purpose."

## 10. Show the custom scenario flow (20s)

Type into "What if…?": `What if oil rises 40% and Nasdaq falls 15%?` →
**Build Scenario**.

> "You're not limited to our five scenarios — describe your own, and we
> translate it into the same structured assumptions you just saw, which
> you can still edit before running."

## 11. Future vision (15s)

> "Today this runs entirely offline. The same architecture is built to
> plug in live risk detection — prediction markets, institutional
> research, financial news — without changing anything downstream."

## Close (10s)

> "We are not trying to predict the future. We help investors understand
> how exposed they are to it."

## If the live demo breaks

Fall back to `docs/screenshots/` (or a recorded video, per `ROADMAP.md`'s
October 3 "demo failure fallback" item) and narrate over the static
images using the same script.
