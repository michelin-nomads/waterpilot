# Google Maps and Places integration

Status: adapter logic is verified with fakes and a limited, explicitly authorized live
browser check on 2026-10-17 (record below). The integrated pilot flow and server provider
remain unverified. This guide does not itself authorize enabling APIs, billing,
provisioning, deployment or further live requests.

## What the existing app connects

| Feature                     | Implementation                                             | Google dependency                                                           |
| --------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Search box                  | `apps/web/src/features/location/googlePlaces.ts`           | Places Library (New): `AutocompleteSuggestion.fetchAutocompleteSuggestions` |
| Selected result             | Same adapter, `select`                                     | `PlacePrediction.toPlace().fetchFields`                                     |
| Map and chosen point/radius | Same adapter, `mountMap`                                   | Maps JavaScript API; maps and marker libraries                              |
| Coordinate/device context   | Same adapter, `reverse`                                    | Browser Geocoder; Geocoding API                                             |
| Server text search          | `services/backend/src/waterlens/adapters/places_google.py` | Places API (New): Text Search                                               |
| Final location and session  | `LocationService.confirm`, `SessionService.update`         | Existing application services, not another Google calculation path          |

Device coordinates come from the browser's geolocation API after a user action, not
from Google's Geolocation API. Do not enable that extra API for this integration.
The server adapter deliberately does not reverse-geocode; the browser owns that feature.
No ADK, Vertex, embeddings or new frontend dependency is needed.

Autocomplete waits 300 ms and requires three characters. One token covers a search and
its selected Place Details request; a new token follows selection or an abandoned-session
timeout. Details request only id, display name, formatted address, location, types and
address components. The script loads lazily; script loading, library imports and data
requests have time bounds. Timeouts fall back to manual entry; they cannot cancel or
refund an SDK request already sent. The offline tests make no Google network requests.

## Environment contract: no code edit after setup

The environment files are validated at startup. Frontend `VITE_` values are baked into
the build: restart Vite or rebuild after changing them. Restart the API after changing
its environment. Do not commit populated environment files or paste keys into chat.

| Variable                   | Where                                        | Purpose                                                    |
| -------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY` | Frontend build environment                   | Public browser key, restricted by website/referrer and API |
| `VITE_GOOGLE_MAPS_MAP_ID`  | Frontend build environment                   | Optional JavaScript Map ID; selects advanced markers       |
| `WL_PLACES_SERVER_KEY`     | Server environment / Secret Manager in pilot | Optional separate secret for server text search            |

These are additional Maps settings, not a replacement for the normal app configuration.
The pilot also requires `VITE_APP_MODE=pilot`, `VITE_USE_EMULATORS=false`, an explicit
HTTPS non-loopback `VITE_API_BASE_URL`, and the actual Firebase web configuration
(`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_APP_ID`). The API needs its normal validated pilot settings, including
`WL_APP_MODE=pilot`, `WL_USE_EMULATORS=false`, a real `WL_GCP_PROJECT` and explicit
`WL_ALLOWED_ORIGINS`. Group 2 owns these prerequisites; this guide does not perform them.

| Configuration                         | Actual behavior                                                         |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Local/emulators, no Google variables  | Fixture search, no Google map; current demo remains usable              |
| Local/emulators with Google variables | Refused unless explicit local browser Maps opt-in is enabled            |
| Pilot without browser/server key      | No map/provider lookup; manual coordinates still work                   |
| Pilot with browser key only           | Browser autocomplete, map and reverse lookup; server search unavailable |
| Pilot with server key only            | Server text search, no browser map                                      |
| Pilot with both keys                  | Both existing adapters are selected automatically                       |

Pasting a key alone does not enable Google locally. The owner-authorized local browser
Maps opt-in now uses these settings together:

```dotenv
# apps/web/.env: keep the existing local Firebase/emulator settings
VITE_LOCAL_GOOGLE_MAPS_ENABLED=true
VITE_GOOGLE_MAPS_API_KEY=YOUR_RESTRICTED_BROWSER_KEY
VITE_GOOGLE_MAPS_MAP_ID=YOUR_JAVASCRIPT_MAP_ID
```

```dotenv
# services/backend/.env: keep WL_APP_MODE=local and WL_USE_EMULATORS=true
WP_LOCAL_GOOGLE_MAPS_ENABLED=true
```

Restart both servers. This permits browser Maps/Places/Geocoder calls only; requests can
be billable under the configured Google project. It does not enable live Vertex, cloud
Firestore, server Places calls, provisioning or deployment. The API selects a no-network
Google-ID confirmation adapter, not its fixture search or a keyed server lookup. Google
place metadata is user-confirmed/provisional, never verified water data or an automatic
boundary. Search and map error/manual-entry handling remain the existing components.
The footer labels this combination “Local backend · live Google Maps”.

Both opt-ins default false. Emulator/demo-project/loopback guards remain mandatory.
The flags are refused in pilot mode, which retains its existing real Firebase/API setup.
To return fully offline, set both opt-ins false and clear the browser Maps variables.
Do not fake pilot configuration to reach a live map.

## Group 2 setup checklist for a separately authorized live phase

1. Use the intended Google Cloud project. Google requires billing for Maps JavaScript.
   Enabling billing or APIs is an owner action, not performed by this guide.
2. For browser features, enable Maps JavaScript API, Places API (New) and Geocoding API.
   Create a browser key with Websites application restrictions limited to the actual
   approved preview/Hosting origins, and API restrictions limited to those three APIs.
   The browser key is visible in the bundle by design; restrictions are essential.
3. Prefer a JavaScript Map ID for advanced markers. Without one the existing adapter
   retains its legacy Marker fallback. Legacy Marker is deprecated, not currently removed.
4. Only if server text search is required, create a separate server key restricted to
   Places API (New). Use an enforceable supported application restriction such as the
   backend's fixed public egress IP. A service-account IAM grant is not an IP restriction
   on this API-key implementation. Group 2 must resolve server egress before exposing it.
5. Set conservative available quotas per enabled API/SKU and monitor usage. Autocomplete,
   Details, map loads, Geocoder and server Text Search have separate billing behavior.
   No free or zero-cost claim is made. Budget alerts are not hard spending caps; the AI
   gateway and `WL_AI_ENABLED` do not govern Maps calls. Current server search has no
   application-level Maps spending ledger; do not expose it broadly on that assumption.
6. Review Google's current attribution, Terms/Privacy and storage requirements. Preserve
   Google map attribution and the search attribution. Do not assume all Places fields may
   be stored for 30 days: permitted caching exceptions depend on content and service terms.
   The existing area expiry flag is not a purge process; retention cleanup remains pending.
7. Verify CSP against Google's current Maps CSP guidance and the actual requests. The
   existing infra origin list is a starting point, not a verified complete CSP.
8. Configure the existing environment contract, build the frontend with pinned Node/npm,
   and perform the explicitly authorized live checks below. No API keys belong in URLs
   to the WaterLens backend, logs, fixtures, screenshots or source control.

## Location semantics that remain unchanged

Search returns candidates; selection opens review; confirmation is explicit. A Google
viewport is a display hint, never a planning boundary. Reference-point and user-radius
extents keep their existing meaning. Maps does not provide rainfall, water supply,
population, verified site boundaries or hydrological connectivity. Those need the
separate Group 1 ingestion and calculation contracts. Synthetic records never become
evidence for a real Google place.

## Verification

Offline, from the repository root with the pinned toolchain already installed:

```bash
npm -w apps/web run test -- src/features/location/googlePlaces.test.ts src/features/location/location.test.tsx src/config/env.test.ts
npm run typecheck
```

The existing backend tests use `httpx.MockTransport` for Google response handling and
check fixture/pilot selection and confirmation/privacy rules. No Google request is made.
See `docs/build/live-integration-tests.md` for separately authorized live checks. The
server reverse method is intentionally unavailable and must not be counted as a live
Geocoding check. Browser Geocoder is checked in the browser instead.

When live verification is authorized, record actual results for: autocomplete → Details →
review → confirm; map click and radius; device permission denial; key/referrer rejection;
provider timeout; manual fallback; reload of the same session; both desktop themes;
and server text search only if its separate key is configured. Do not mark these passed
based on fake SDK tests.

### Local check record — 2026-10-17

- Existing location/config frontend suites plus focused adapter regressions: 91 passed.
- Backend location service/API suites, with mocked Google transport: 49 passed.
- TypeScript, targeted ESLint, targeted Ruff and adapter mypy: passed.
- Production build and bundle-budget check: passed.
- Formatting and patch whitespace checks: passed.
- At the offline-check stage, live Maps/Places/Geocoder, key restrictions, CSP and
  retention cleanup were unverified; that stage made no Google application calls.
  The later limited live check is recorded separately below.
- The synthetic Group 1 input pack is separate from Maps integration and stays synthetic.

## Authorized browser credential check — 2026-10-17

The owner added `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` to the
ignored frontend `.env` and explicitly requested a working check. Neither value was
logged, committed or included in screenshots.

The app remains `local`/emulator-only, where its guard correctly refuses these live
settings. A temporary, isolated loopback page at `http://127.0.0.1:5184` imported the
existing `googleMapsLoader.ts` and `googlePlaces.ts` adapters directly. It did not
change app guards, Firebase configuration, backend configuration or saved planning data.
Only public Bengaluru place names and city-centre coordinates were used.

| Check                                  | Actual result                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Maps JavaScript with configured Map ID | PASS: visible Google tiles in Bengaluru                                                         |
| Advanced marker                        | PASS: visible marker using the configured Map ID path                                           |
| Places autocomplete                    | PASS: one explicit search returned five Koramangala suggestions                                 |
| Place Details                          | PASS: chosen Koramangala returned coordinates, IN country code, Karnataka and Bengaluru context |
| Browser Geocoder                       | PASS: one explicit public city-centre lookup returned five normalized candidates                |
| Browser Maps errors/warnings           | None reported by the diagnostic console at inspection time                                      |

One explicit map initialization, autocomplete search, selected Details request and
Geocoder request were triggered. SDK/tile network request totals and resulting charges
were not measured. No resources, APIs or billing were activated; no deployment or
Vertex/LLM call occurred. The temporary page and configuration endpoint are loopback-only
and are not project/deployment assets.

This proves the browser key and Map ID worked from the diagnostic origin at that time.
It does not prove correct restriction enforcement on other origins, production CSP,
server-key access, map click/radius/device interactions, or the full app's authenticated
search-to-confirm/reload flow. Those remain separate checks. At the time of this isolated check no local-mode exception existed. The subsequent
explicit, default-off local browser opt-in is documented above.

## Official references

- [Load Maps JavaScript](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Autocomplete Data API and sessions](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data)
- [Advanced-marker migration](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration)
- [API-key security](https://developers.google.com/maps/api-security-best-practices)
- [Maps usage and billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
- [Places policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Content Security Policy](https://developers.google.com/maps/documentation/javascript/content-security-policy)

## Main-app local browser Maps opt-in verification — 2026-10-17

The owner requested the live map in the main app. The two explicit local-only flags above
were implemented, enabled in ignored local environment files, and tested at
`http://127.0.0.1:5182/area` with local API 8007. Both flags default off; the API remains
no-network for Places. Firebase Auth/Firestore stay on `demo-waterlens` emulators. AI
was explicitly disabled on this preview API; no Vertex, deployment or provisioning ran.

A React StrictMode lifecycle defect was found in the real map integration: a cancelled
async mount could clear a later map's shared container. Each mount now owns a separate
canvas; cleanup cannot erase the active map. One focused regression covers that race.

Actual results:

- Frontend location, Maps adapter and environment suites: **93 passed** (one new opt-in
  guard test and one map-lifecycle regression, reusing existing coverage).
- Backend location, configuration and location GraphQL suites: **89 passed** (one new
  local Google confirmation/no-server-call test; default/pilot guards retained).
- Targeted ESLint/Ruff, TypeScript build/typecheck and mypy (154 files): **passed**.
- Production build and bundle budget: **passed**; initial JS **149.96 kB gzip** against
  the existing 150 kB budget. There is little headroom for further entry-chunk growth.
- Manual browser: live map tiles/marker, Koramangala autocomplete and Details, explicit
  1 km radius confirmation through the local authenticated API, navigation to Baseline,
  and recovery of the saved provisional Google place: **passed**. The real place did not
  gain synthetic water-source coverage; Baseline correctly requested manual inputs.
- Main location screen visually inspected in dark at 1440×900 and light at 1024×900.
  No Google errors/warnings were observed. This is not a claim of all-screen acceptance.
- The review map currently previews the point marker; the radius is explicitly selected
  and saved, but no live radius overlay was verified in that review state.
- Manual timeout/rejection/device-permission and map-click paths were not rerun live;
  their fake coverage remains separate. Server-key search and production CSP remain
  unverified. Saved Google metadata retains the existing provisional/expiry behavior;
  the previously recorded retention-cleanup limitation remains open.

Vite served stale transformed modules during edits; a clean server restart was needed
before verifying the lifecycle fix. No secret was logged or committed. Live Maps usage
may be metered; no invoice amount or global spend cap was verified.


### Live lookup failure checked 2026-10-17

An explicit lookup using the configured local browser key returned:

- Geocoder: `REQUEST_DENIED` — “The webpage is not allowed to use the geocoder.”
- Places Nearby Search: `PERMISSION_DENIED` — `Places.SearchNearby` is blocked.

A working map load does not establish permission to reverse-geocode. The project must
have Geocoding API enabled and the website-restricted browser key must allow it.
The existing Nearby fallback also needs Places API (New) / `SearchNearby` permission.
Keep website/referrer restrictions in place; do not make the key unrestricted.
See [Google's API key error guidance](https://developers.google.com/maps/documentation/javascript/error-messages).
The current Cloud CLI login requires reauthentication, so cloud settings could not be
inspected or changed during this check. No APIs, key restrictions, or billing settings
were modified.
