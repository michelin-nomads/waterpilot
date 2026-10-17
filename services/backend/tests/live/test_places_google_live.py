"""Live-only: the server-side Google Places (New) adapter against Google.

Unit tests use fake response shapes; only the metered checks here verify that Google
still answers the field mask and returns worldwide and ambiguous candidates. A separate
contract check asserts that server reverse lookup is unavailable (browser Geocoder owns it).
Opt-in twice over: the ``live`` marker is deselected by default,
and every metered test skips unless ``WL_LIVE_PLACES_SERVER_KEY`` is set in the shell.

    WP_LIVE_PLACES_SERVER_KEY=<restricted server key> uv run pytest -m live tests/live

The adapter is constructed directly. ``Settings`` and the local-mode guards (which refuse
``WL_PLACES_SERVER_KEY`` when ``WL_APP_MODE=local``) are not touched, so this cannot make a
local run fall through to Google. Each run makes at most three metered requests
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


def test_server_reverse_lookup_is_explicitly_unavailable() -> None:
    with pytest.raises(PlaceSearchUnavailable, match="browser"):
        GooglePlaceSearch("not-a-real-key").reverse(-12.0464, -77.0428, limit=3)


def test_a_rejected_key_is_unavailable_and_never_echoed() -> None:
    if not KEY:
        pytest.skip("set WP_LIVE_PLACES_SERVER_KEY to run live Google Places checks")
    with pytest.raises(PlaceSearchUnavailable) as caught:
        GooglePlaceSearch("not-a-real-key").search("Nairobi", limit=1)
    assert "not-a-real-key" not in str(caught.value)
