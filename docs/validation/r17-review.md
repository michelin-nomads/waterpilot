# R17 Review screen validation

Date: 2026-10-16

Review remains nested in the planning layout, retaining the stage nav and Copilot
pane. It presents separate location, goal, selected plan, assumptions and save
sections. Plan name and figures come from the current server comparison, not the
selected option ID. Edit actions return to Location, Baseline overview, Goal and
Compare in the same session. Save is blocked while upstream edits are pending,
the comparison cannot load, or the selected option's status is not CURRENT for
the current inputs. The existing finalization and guest identity flow remains
the only save path; reports are immutable snapshots.

The current location contract provides no boundary geometry or map tiles, so
Review states the selected point/radius treatment and offers Edit rather than
showing a misleading map. The test file `Review.test.tsx` covers the authoritative
plan name/figures and the stale-impact block. Existing `useFinalizeReport` tests
cover identity and finalization behavior.

Browser visual inspection in both themes at 1440px and 1024px and the guest/signed
in save journey remain unverified in this local run. The tab is served by stale
Vite output. No live services were called.
