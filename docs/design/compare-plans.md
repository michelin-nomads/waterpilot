# Compare plans

The screen compares feasible combinations against the user's current goal. It keeps WaterPilot's Estuary palette, navy typography, neutral surfaces, teal selection states and existing light/dark tokens.

## Layout

- A full-width shared location preview establishes what is being compared. The feasible-status blurb and separate sample banner are removed; preview identification stays in the page eyebrow and footer. The comparison basis keeps baseline, target and an optional what-if together.
- Up to three cards sit side by side when space permits. Each shows plan number, server-ranked first option, measures, estimated cost, implementation time, first benefit and the projected goal outcome. Cards stack on smaller screens.
- Measures, costs and wider impacts are collapsed. Useful calculation assumptions, ranking rules and excluded measures appear in the plan-details drawer. The standalone “Assumptions, ranking and versions” section and software-version labels are removed. View plan details opens the existing drawer; important false-resilience warnings stay visible on the card.
- Projected outcomes and neighbourhood impact sit below the cards in separate panels. The chart shows API-provided outcome ranges on a common scale with the goal marked. No yearly water-availability forecast is fabricated.
- Neighbourhood impact reflects the selected plan, or explicitly previews the first option. Nearby records, system connections, sources and unknowns remain inspectable. There is no invented impact heatmap.
- The footer names the selection and only permits continuing when it is current and saved. Existing stale-selection checks remain in place.

## Preview

`/design-system/compare-plans` is available only in local mode. Its three sample plans are explicitly illustrative and use the same comparison components as the real screen. Selecting and inspecting a sample does not write to the planning session.

The live `/plans` page continues to use PlanComparison and the session coordinator. Balanced, lower-cost and higher-impact names in the preview are sample labels; live names and ranking come from the API.
