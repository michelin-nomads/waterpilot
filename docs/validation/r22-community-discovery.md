# R22 Discover nearby communities

Date: 2026-10-16

Discovery now presents My communities, Discover nearby, and All communities
controls, plus bounded search, active/archive visibility and the existing capped
radius query. Cards keep the safe area/member/proximity summary, immediate Join,
and detail links. The centroid distance is explicitly not hydrological
connectivity. The selected location is used transiently and no exact private
location is shown.

**Presentation gap:** the current community query does not return display
coordinates or map shapes. The nearby state explicitly says map pins are
unavailable and retains the accurate list instead of fabricating points.

Automated browser state inspection remains unverified; no dedicated new test was
added because existing membership and query behavior is already covered in the
service layer. Desktop visual inspection remains pending. No live services were
called.
