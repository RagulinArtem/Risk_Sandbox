# Product UI System

The interface is inspired by the clarity of modern consumer-finance apps,
especially Revolut's public product direction, without copying its brand or
visual assets.

## Reference patterns

- [Revolut 10](https://www.revolut.com/news/revolut_launches_revolut_10_as_it_targets_primary_accounts_and_passes_35m_customers_worldwide/): a clearer account overview, fast access to important actions and a customizable home experience.
- [Revolut 9](https://www.revolut.com/blog/post/discover-rev-9-0/): home-screen widgets that expose analytics and frequent actions without forcing users through deep navigation.
- [Revolut analytics](https://help.revolut.com/it-IT/help/accounts/budget-and-analytics/what-is-the-analytics-dashboard/): one dashboard that groups spending, income, cashflow and wealth views.

The transferable idea is not “make it look like Revolut.” It is: show the next
useful decision first, progressively disclose detail, and let every important
number lead somewhere.

## Information architecture

- **Home** — plain-language risk snapshot and fast scenario exploration.
- **Stress analytics** — assumptions, deterministic result, attribution,
  committee interpretation and allocation sandbox.
- **Alerts & signals** — attributed live events, scenario library and risk
  attention map. A device-local watch threshold can be saved on Home; it does
  not claim to provide background push notifications.
- **Portfolio** — holdings and performance first; specialist analytics live
  behind “More analytics.”
- **Settings** — presentation and data-label explanations. It must not show
  controls that are not actually implemented.
- **Report** — printable output, intentionally outside the primary nav.

## Visual principles

1. **Calm base, one accent.** Warm-white cards, light-grey canvas, near-black
   type and violet for interaction. Red, amber and green are reserved for
   meaning.
2. **Cards explain, not decorate.** Each home card has one headline insight,
   supporting context and one clear action.
3. **Friendly charts.** Softer grids, rounded tooltips, direct labels and wider
   strokes replace terminal-like presentation. Tables retain full precision.
4. **Entertainment through interaction.** Slider feedback, small scenario
   illustrations and restrained motion make exploration engaging without
   gamifying losses.
5. **Progressive disclosure.** The home screen is simple; provenance,
   methodology and detailed factor views remain one click away.

## Financial truth rules

- The frontend never calculates portfolio impact; it renders typed backend
  responses.
- A semicircle gauge visualizes a real scenario result, not a fabricated score.
- The diversification widget exposes independent drivers and concentration
  metrics instead of compressing them into an arbitrary 0–100 grade.
- The quick what-if is explicitly illustrative and sends factor shocks to the
  deterministic stress engine. Parameter combinations can be saved locally and
  recalled without persisting a stale impact number.
- CTAs say “explore,” “review,” or “compare.” They do not recommend securities,
  promise mitigation or execute trades.
- Historical, live, cached and illustrative data keep their existing labels and
  provenance.

## Interaction and accessibility

- Primary targets are at least 40 px high; keyboard focus remains visible.
- Reduced-motion preferences disable decorative transitions and gauge motion.
- Desktop navigation stays visible; mobile navigation moves to a reachable
  five-item bottom bar.
- Color is never the only source of meaning: values, labels and status text
  accompany visual encoding.

## Near-term extensions

- Let users choose which real widgets appear on Home and persist the layout.
- Promote the device-local watch threshold to server-side alert rules before
  exposing notification permission prompts or promising background delivery.
- Add scenario-card editorial imagery only when licensing, attribution and
  loading fallbacks are defined; generated abstract artwork is safer than
  implying that a generic news photo is evidence.
