# Live integration tests (opt-in, owner-run)

Nothing on this page runs in CI, in `npm test`, or in any local mode. Every check here
calls a real Google service, may be metered, and needs credentials that live only in the
operator's shell. **None of them has been run yet**, so real Google Maps and Places
behaviour, and real dataset coverage, are **unverified**.

## Guards that stay in place

These rules don't change for live testing:

- `WL_ENV=local` refuses `WL_PLACES_SERVER_KEY`, and the web app's local mode refuses
  `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` (`services/backend/src/waterlens/config.py`,
  `apps/web/src/config/env.ts`). Live tests never set these variables and never change
  `Settings`.
- The backend live tests build the adapter they test directly from a `WL_LIVE_*`
  variable, so a local API process can never reach Google because of them.
- The default `pytest` run deselects the `live` marker (`addopts` in `pyproject.toml`).
  Each live test also skips unless its variable is set.
- The Playwright suite aborts every request to a Google host (`e2e/location.spec.ts`).
  The browser checks below run by hand against a pilot preview, never through the e2e
  suite.
- No key, response body or coordinate is printed. Assertions are structural.

## 1. Server-side Places (New) and Geocoding

File: `services/backend/tests/live/test_places_google_live.py`.

Before running this test, the owner must:

- create a restricted server key, as in `infra/README.md` step 3;
- set per-API daily quotas and a budget alert;
- export the key only for this command.

```bash
cd services/backend
WL_LIVE_PLACES_SERVER_KEY=... uv run pytest -m live tests/live/test_places_google_live.py -rs
```

| Test                                                       | What it shows                                                      | Requests      |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------- |
| `test_a_place_outside_india_resolves_with_country_and_...` | Text Search with the field mask; worldwide; normalized id/country  | 1 Text Search |
| `test_an_ambiguous_name_returns_more_than_one_candidate`   | Ambiguous names come back as several candidates                    | 1 Text Search |
| `test_a_point_reverse_geocodes_to_named_context`           | Reverse geocoding of a point outside India                         | 1 Geocoding   |
| `test_a_rejected_key_is_unavailable_and_never_echoed`      | A bad key becomes `PlaceSearchUnavailable` without echoing the key | 1 (rejected)  |

A full run makes at most four requests. Check current SKU prices on the Google Maps
Platform pricing page before running it.

## 2. Browser Maps JavaScript, Places autocomplete and Geocoder (manual)

Run this against a **pilot preview** served from a domain that the browser key's HTTP
referrer restriction allows. Deploying the preview is an owner action (Prompts 25–26).
The web build uses `VITE_WATERLENS_ENV=pilot` and the restricted browser key from
`infra/README.md` step 1. Never run it from a local-mode build.

| #   | Step                                                                    | Expected                                                                                                                   |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| B1  | Open the location step                                                  | The Maps script loads only now. The map shows "Powered by Google".                                                         |
| B2  | Type "Nair", then "Nairobi" quickly                                     | One autocomplete session (DevTools: same `sessiontoken`). Requests start after a pause. Older answers never replace newer. |
| B3  | Choose Nairobi                                                          | One Place Details request with only the listed fields. The review shows KE, KES and Africa/Nairobi with no extent chosen.  |
| B4  | Search "Springfield"                                                    | Several candidates and a "choose the one you mean" prompt. Nothing is preselected.                                         |
| B5  | Block `maps.googleapis.com` in DevTools and reload                      | "The map is unavailable". Typed coordinates and custom entry still complete the step.                                      |
| B6  | Use a key from another referrer (or remove the referrer)                | `gm_authFailure` leads to the map-unavailable fallback. No key appears in the page text.                                   |
| B7  | Deny location permission, then let the location request time out (slow) | Each failure gives a specific message. Search and manual entry stay open.                                                  |
| B8  | Leave a search idle for more than 3 minutes, then keep typing           | A new session token is used.                                                                                               |

Record the date, the build commit and the result of each step in `docs/progress.md`.
Mark each step verified only after it has been observed.

## 3. Real dataset coverage

Readiness for real areas depends on sources ingested through Prompt 07's pipeline.
Coverage is unverified until reviewed source releases exist for the pilot region and a
confirmed live area reports `SOURCED` or `LIMITED`, with capability evidence that names
those releases. The local gazetteer and the synthetic catalogue (marked "Test place" and
`SYNTHETIC`) are not coverage.

## 4. Firestore indexes

File: `services/backend/tests/live/test_firestore_live_indexes.py`. Run it with
`WL_LIVE_FIRESTORE_PROJECT=...`. It is described in the file's docstring and makes read-only
`limit(1)` probes.
