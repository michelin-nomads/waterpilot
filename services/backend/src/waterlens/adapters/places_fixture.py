"""Local test gazetteer (``docs/domain/fixtures/gazetteer.json``): local mode and tests use
it instead of Google Places, so no billable call is ever made. Approximate points only."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

from waterlens.domain.location import PlaceCandidate

GAZETTEER = Path(__file__).resolve().parents[5] / "docs" / "domain" / "fixtures" / "gazetteer.json"
REVERSE_RADIUS_KM = 25.0


def _words(text: str) -> list[str]:
    return re.findall(r"\w+", text.casefold())


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


class FixturePlaceSearch:
    provider = "fixture"

    def __init__(self, path: Path = GAZETTEER) -> None:
        data = json.loads(path.read_text(encoding="utf-8"))
        self._places = tuple(PlaceCandidate.model_validate(_snake(p)) for p in data["places"])

    def search(self, text: str, limit: int) -> tuple[PlaceCandidate, ...]:
        """Every query word must prefix a word of the place's name or address."""
        query = _words(text)
        if not query:
            return ()
        hits = []
        for place in self._places:
            words = _words(f"{place.name} {place.formatted_address or ''}")
            if all(any(w.startswith(q) for w in words) for q in query):
                hits.append(place)
        return tuple(hits[:limit])

    def reverse(self, lat: float, lon: float, limit: int) -> tuple[PlaceCandidate, ...]:
        near = sorted(
            ((_km(lat, lon, float(p.latitude), float(p.longitude)), p) for p in self._places),
            key=lambda pair: pair[0],
        )
        return tuple(p for km, p in near if km <= REVERSE_RADIUS_KM)[:limit]


def _snake(place: dict[str, object]) -> dict[str, object]:
    admin = place.get("admin") or {}
    assert isinstance(admin, dict)
    return {
        "place_id": place["placeId"],
        "name": place["name"],
        "formatted_address": place.get("formattedAddress"),
        "latitude": place["latitude"],
        "longitude": place["longitude"],
        "country_code": place.get("countryCode"),
        "admin": {
            "country_name": admin.get("countryName"),
            "admin1": admin.get("admin1"),
            "admin2": admin.get("admin2"),
            "locality": admin.get("locality"),
            "sublocality": admin.get("sublocality"),
        },
        "types": place.get("types") or (),
    }
