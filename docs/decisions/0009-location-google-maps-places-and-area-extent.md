# ADR 0009 — Location: Google Maps and Places, device location and area extent

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Project owner (Prompt 08 explicitly names Google Maps JavaScript and
  Places); implementation in Prompt 08
- **Phase:** Prompt 08 — Location search, device location and coverage routing

## Context

The project rules say a basemap or tile service needs a documented licence and cost
decision. Prompt 08 makes that decision. It names Google Maps JavaScript and Places,
behind an adapter so tests make no calls. It asks for:

- browser geolocation only after a user action, then confirmation;
- fallbacks for permission denial, timeout, an inaccurate fix, manual search and an
  unavailable map;
- Places autocomplete session handling, debouncing and field masks, with a browser key
  restricted by referrer and API;
- normalized place id, country, coordinates, administrative context and scope;
- no fabricated neighbourhood boundaries;
- locations accepted worldwide, with unsupported ones routed to a labelled user-input
  assessment;
- currency, time zone and units stored apart from the UI language;
- ambiguous names answered with candidates and a question, never a default.

## Decision

1. **Adapters on both sides.**
   - The web depends on a `PlacesAdapter` interface (`features/location/types.ts`) with
     these operations: suggest, select, reverse and mountMap.
   - The backend depends on a `PlaceSearch` port with these operations: search and
     reverse.

   | Mode                   | Web adapter                                                      | Backend `PlaceSearch`                                                                                              |
   | ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
   | Local                  | `serverPlaces('fixture')`: GraphQL to the API, no map            | `FixturePlaceSearch` (labelled gazetteer JSON)                                                                     |
   | Pilot with browser key | `googlePlaces`: Maps JS + Places (New) + Geocoder in the browser | `GooglePlaceSearch` only if `WP_PLACES_SERVER_KEY` is set                                                          |
   | Pilot without key      | `serverPlaces('server')`, no map                                 | Otherwise `NoPlaceSearch("google")`: no server lookups, but confirmations of browser Google place ids are accepted |

   Local mode refuses `VITE_GOOGLE_MAPS_*` (web) and `WP_PLACES_SERVER_KEY` (API), so it
   can never call Google. Tests inject fakes: a fake `PlacesAdapter`, a fake
   `google.maps` namespace and an `httpx.MockTransport`. The end-to-end suite aborts any
   request to a Google host.

2. **Browser key.**
   - `VITE_GOOGLE_MAPS_API_KEY`, plus an optional `VITE_GOOGLE_MAPS_MAP_ID`, is a public
     identifier like the Firebase web key.
   - It is protected by Google Cloud restrictions, not by secrecy:
     - HTTP referrers limited to the Hosting domains;
     - APIs limited to Maps JavaScript, Places API (New) and Geocoding;
     - daily quotas and budget alerts.
   - The web validates its shape (`AIza…`, 39 characters).
   - The script is loaded on demand (`loading=async`, `v=weekly`, with a callback) when
     the location step mounts, never at app start. Loading times out after 10 s, and
     `gm_authFailure` (rejected key) turns into the map-unavailable fallback.
   - The server key (`WP_PLACES_SERVER_KEY`) is a secret. It is used only by the API's
     Text Search (agent and fallback search) and must be IP- or service-restricted.
3. **Places practice.**
   - One `AutocompleteSessionToken` covers the keystrokes of one search and the Place
     Details `fetchFields` call that ends it. A new token starts afterwards.
   - Requests wait 300 ms after the last keystroke and need at least 3 characters.
     Superseded answers are dropped.
   - Place Details fields are `id`, `displayName`, `formattedAddress`, `location`,
     `types` and `addressComponents` (no Enterprise or Atmosphere fields).
   - Server Text Search sends an explicit `X-Goog-FieldMask` with the same data plus
     `viewport`.
   - "Powered by Google" attribution is shown beside results.
4. **Caching terms.**
   - Google place ids may be kept indefinitely. Other Places content (name, address,
     coordinates) may be cached for at most 30 consecutive calendar days.
   - A confirmed Google area therefore stores `provider_expires_at = confirmed + 30 days`.
     After that, `Area.providerContentExpired` is true, and the location summary asks the
     person to choose the place again.
   - Autocomplete results are never put in the shared query cache.
   - Expired content is not yet purged automatically. A purge job (or Firestore TTL on a
     derived field) is a pre-pilot task, tracked in implementation status.
   - The owner must confirm the current Google Maps Platform terms before the pilot.
5. **A place is not a catchment.**
   - An area has an `origin`: `catalogue`, `place_search`, `geolocation` or `custom`.
   - It has an `extent`:
     - `reviewed_boundary`: catalogue areas only, from a reviewed source.
     - `user_radius`: 100 m to 50 km. Stored as a bounding box and labelled as the
       person's assumption.
     - `reference_point`: no bounding box.
   - There is no default. The person must choose `reference_point` or `user_radius`
     before confirming; the GraphQL input and the service both require `extent`.
   - The provider's viewport is never stored as a boundary. The review screen says that a
     name or point is not a catchment or ward, and that steps needing an area use the
     radius or ask.
6. **Worldwide, with region settings apart from language.**
   - Country is required. When the provider reports none, the person chooses it.
   - Currency comes from CLDR via Babel. The time zone comes from the point via tzfpy,
     with UTC as the fallback. The unit system is US customary for US, LR and MM, and
     metric elsewhere.
   - None of these come from the UI locale.
   - After confirmation, readiness runs for the new area, and `AreaReadiness.basis`
     reports one of:
     - `SOURCED`: at least one capability is available.
     - `LIMITED`: some capabilities are partial or stale.
     - `USER_INPUT`: no source covers the area. The area page labels this as a
       user-input assessment.
7. **Device location.**
   - It is requested only from the "Use my current location" button.
   - Every failure is a classified outcome with its own message: denied, timeout,
     unavailable, unsupported or insecure.
   - A fix worse than 1000 m is flagged as imprecise, and nearby named places (from
     reverse geocoding) are offered instead.
   - The person always reviews the location before it is saved.
8. **Privacy.**
   - Geolocation and custom areas carry `owner_uid`. Other users get `NOT_FOUND`,
     `Report.area` is null for them, and communities refuse private areas.
   - Area name search returns catalogue areas only.
   - An area id is derived from the origin, the owner (`shared` for searched places) and
     every confirmed field. Two people confirming the same place details share one
     area. Different details (a renamed place, other coordinates, another country or
     region choice) create a new area, so a client can never overwrite a shared area
     that another session points at. The server does not verify browser-supplied place
     details against Google; it records them as `place_search` provenance.
   - A device fix keeps only administrative context. The reverse-geocoded street address
     is not stored.
9. **Single writer.** `confirmLocation` (idempotent) only creates the area. The client
   then calls `coordinator.setArea(id)`, so the session coordinator remains the only
   writer of the session (ADR 0006).
10. **Agents.** `LocationService.resolve(text)` returns up to five candidates,
    `needsClarification` and a question. It never chooses for the person, and a single
    match still needs confirmation. "Koramangala" in an agent message therefore yields
    candidates, not a Bangalore default. The agent wiring itself is Prompts 15–17.
11. **New backend dependencies.**
    - `babel>=2.18,<3` (BSD-3-Clause; CLDR data under the Unicode licence; about 33 MB
      installed).
    - `tzfpy>=2.1,<3` (MIT; Rust wheels; about 5 MB; its timezone-boundary-builder data
      is ODbL, so attribution is in `docs/dependencies.md`).
    - Both are server-side only.
12. **CSP.** Hosting has no Content-Security-Policy yet. The Prompt 25 policy must allow
    `https://maps.googleapis.com` and `https://maps.gstatic.com` (script, image, connect)
    and `https://places.googleapis.com` (connect). Otherwise the map fallback appears.

## Amendments from the Prompt 08 review

- **Region certainty and correction.**
  - `regionSettings(latitude, longitude, countryCode)` previews the inferred values
    before confirming: currency, the currency options, time zone, the time-zone options
    and units.
  - Currency is certain only when the country has exactly one CLDR tender. Bhutan, for
    example, has two: INR and BTN.
  - Time zone is certain only when the country has a single CLDR zone.
  - The review shows a "Please check" notice when either is uncertain. The person can
    change the country, currency and time zone.
  - Overrides are validated against ISO 4217 and the system tz database, and are listed
    in `Area.regionSetByUser`.
- **Readiness uses only values entered for the current area.** Manual inputs are matched
  on `area_id`, so changing location never carries over population or demand figures.
- **Bounded Google calls in the browser.**
  - Suggest, Place Details and Geocoder calls each time out after 8 s and become the
    unavailable fallback.
  - A session token older than 3 minutes is replaced.
- **Fixture places are labelled.** Gazetteer results show a "Test place" badge in search
  and the review. Confirmed fixture areas show `SYNTHETIC` evidence.
- **Live tests.** `docs/build/live-integration-tests.md` describes an opt-in configuration
  that leaves every local-mode guard unchanged.

## Cost

Google Maps Platform is metered per SKU:

- dynamic map loads;
- Autocomplete requests and sessions;
- Place Details, which depends on the requested fields;
- Geocoding;
- server Text Search.

Free monthly usage caps and prices change, so this ADR states none. The owner checks the
current pricing page and sets these before adding a key:

- per-API daily quotas;
- a billing budget with alerts.

Session tokens and the minimal field list keep each search to the fewest billable
requests. Local mode and all tests cost nothing because they never call Google. **No zero
cost is promised.** Usage beyond the free caps and credits is billed.

## Consequences

- Locations outside reviewed coverage still complete the step and are clearly labelled.
- Search, device location and typed coordinates work without a map, so a Maps outage or
  key problem never blocks planning.
- A new Firestore composite index (`areas`: `origin` ascending, `_sort` descending) and
  single-field exemptions for `areas.admin` and `areas.boundary_bbox` are required.
- **Still pending (live):**
  - Google key restrictions, quotas and billing;
  - the 30-day purge job;
  - live calls to Places, Geocoding and Maps JS;
  - the CSP.

  None of these has been exercised. Only fakes and the local gazetteer have been
  tested.
