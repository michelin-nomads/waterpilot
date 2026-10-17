"""Live-only: the server-side Google Places (New) and Geocoding adapter against Google.

Unit tests replay recorded response shapes; only this checks that Google still answers
the field mask, that worldwide and ambiguous names come back as candidates, and that a
point reverse-geocodes. Opt-in twice over: the ``live`` marker is deselected by default,
and every test skips unless ``WP_LIVE_PLACES_SERVER_KEY`` is set in the operator's shell.

    WP_LIVE_PLACES_SERVER_KEY=<restricted server key> uv run pytest -m live tests/live

The adapter is constructed directly. ``Settings`` and the local-mode guards (which refuse
``WP_PLACES_SERVER_KEY`` when ``WP_ENV=local``) are not touched, so this cannot make a
local run fall through to Google. Each run makes at most four metered requests
(see docs/build/live-integration-tests.md). Results are asserted structurally only and
never printed.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

from waterpilot.adapters.places_google import GooglePlaceSearch
from waterpilot.application.ports import PlaceSearchUnavailable

pytestmark = pytest.mark.live

KEY = os.environ.get("WP_LIVE_PLACES_SERVER_KEY", "")


@pytest.fixture(scope="module")
def places() -> Iterator[GooglePlaceSearch]:
    if not KEY:
        pytest.skip("set WP_LIVE_PLACES_SERVER_KEY to run live Google Places checks")
    yield GooglePlaceSearch(KEY)


def test_a_place_outside_india_resolves_with_country_and_coordinates(
    places: GooglePlaceSearch,
) -> None:
    [nairobi, *_] = places.search("Nairobi, Kenya", limit=3)
    assert nairobi.place_id.startswith("google:")
    assert nairobi.country_code == "KE"
    assert -2.0 < float(nairobi.latitude) < -0.5
    assert 36.0 < float(nairobi.longitude) < 37.5


def test_an_ambiguous_name_returns_more_than_one_candidate(places: GooglePlaceSearch) -> None:
    candidates = places.search("Springfield", limit=5)
    assert len({(c.country_code, c.admin.admin1) for c in candidates}) > 1


def test_a_point_reverse_geocodes_to_named_context(places: GooglePlaceSearch) -> None:
    [nearest, *_] = places.reverse(-12.0464, -77.0428, limit=3)
    assert nearest.country_code == "PE"


def test_a_rejected_key_is_unavailable_and_never_echoed() -> None:
    if not KEY:
        pytest.skip("set WP_LIVE_PLACES_SERVER_KEY to run live Google Places checks")
    with pytest.raises(PlaceSearchUnavailable) as caught:
        GooglePlaceSearch("not-a-real-key").search("Nairobi", limit=1)
    assert "not-a-real-key" not in str(caught.value)
