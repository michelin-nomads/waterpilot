"""Google Places API (New) Text Search for server-side place lookup (pilot only; ADR 0009).

Requests carry an explicit field mask (only the fields normalised below), a language and
a small page size. Text Search is billed per request at the SKU its field mask selects;
there is no autocomplete session for server calls. Reverse lookup of a point is not done
server-side: the browser uses the Maps JavaScript Geocoder for that.
"""

from __future__ import annotations

from typing import Any

import httpx

from waterlens.application.ports import PlaceSearchUnavailable
from waterlens.domain.location import AdminContext, PlaceCandidate

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join(
    f"places.{f}"
    for f in (
        "id",
        "displayName",
        "formattedAddress",
        "location",
        "viewport",
        "types",
        "addressComponents",
    )
)
TIMEOUT_S = 8.0


def _component(components: list[dict[str, Any]], kind: str, short: bool = False) -> str | None:
    for c in components:
        if kind in c.get("types", ()):
            value = c.get("shortText" if short else "longText")
            return str(value)[:120] if value else None
    return None


def _coord(value: Any) -> str:
    return f"{float(value):.7f}".rstrip("0").rstrip(".")


def candidate(place: dict[str, Any]) -> PlaceCandidate:
    comps: list[dict[str, Any]] = place.get("addressComponents") or []
    country = _component(comps, "country", short=True)
    loc = place["location"]
    view = place.get("viewport")
    viewport = None
    if view:
        lo, hi = view["low"], view["high"]
        if lo["longitude"] <= hi["longitude"]:  # crossing the antimeridian: no viewport
            viewport = (lo["longitude"], lo["latitude"], hi["longitude"], hi["latitude"])
    return PlaceCandidate(
        place_id=f"google:{place['id']}",
        name=str((place.get("displayName") or {}).get("text") or place["id"])[:200],
        formatted_address=(place.get("formattedAddress") or None),
        latitude=_coord(loc["latitude"]),
        longitude=_coord(loc["longitude"]),
        country_code=country if country and len(country) == 2 else None,
        admin=AdminContext(
            country_name=_component(comps, "country"),
            admin1=_component(comps, "administrative_area_level_1"),
            admin2=_component(comps, "administrative_area_level_2"),
            locality=_component(comps, "locality"),
            sublocality=_component(comps, "sublocality") or _component(comps, "neighborhood"),
        ),
        types=tuple(str(t) for t in place.get("types", ())[:30]),
        viewport=viewport,
    )


class GooglePlaceSearch:
    provider = "google"

    def __init__(self, api_key: str, transport: httpx.BaseTransport | None = None) -> None:
        self._client = httpx.Client(timeout=TIMEOUT_S, transport=transport)
        self._key = api_key

    def search(self, text: str, limit: int) -> tuple[PlaceCandidate, ...]:
        try:
            response = self._client.post(
                SEARCH_URL,
                headers={"X-Goog-Api-Key": self._key, "X-Goog-FieldMask": FIELD_MASK},
                json={"textQuery": text, "pageSize": limit, "languageCode": "en"},
            )
        except httpx.HTTPError as err:
            raise PlaceSearchUnavailable(f"place search failed: {type(err).__name__}") from None
        if response.status_code != 200:
            raise PlaceSearchUnavailable(f"place search failed: HTTP {response.status_code}")
        try:
            body = response.json()
        except ValueError:
            raise PlaceSearchUnavailable("place search returned an invalid response") from None
        if not isinstance(body, dict):
            raise PlaceSearchUnavailable("place search returned an invalid response")
        places = body.get("places", [])
        if not isinstance(places, list):
            raise PlaceSearchUnavailable("place search returned an invalid response")
        out: list[PlaceCandidate] = []
        for place in places[:limit]:
            if not isinstance(place, dict):
                continue
            try:
                out.append(candidate(place))
            except (KeyError, TypeError, ValueError):
                continue  # a malformed entry is dropped, never guessed at
        return tuple(out)

    def reverse(self, lat: float, lon: float, limit: int) -> tuple[PlaceCandidate, ...]:
        raise PlaceSearchUnavailable("reverse lookup runs in the browser")
