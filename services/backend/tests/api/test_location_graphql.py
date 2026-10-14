"""Location over GraphQL (ADR 0009): candidates with clarification, confirmation with
region settings, owner-only private areas, and the user-input readiness basis."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from api.test_graphql_behaviour import create_community, finalize, join, ready_session
from conftest import LOCAL_OK, LoadSettings
from graphql_harness import AREA_ID, Harness, make_harness

RESOLVE = """
query($text: String!) {
  resolveLocation(text: $text) {
    query provider needsClarification question
    candidates { placeId name countryCode scope latitude longitude admin { countryName } }
  }
}"""

CONFIRM = """
mutation($input: ConfirmLocationInput!) {
  confirmLocation(input: $input) {
    area {
      id name countryCode timezone currency unitSystem origin scope extent radiusMeters
      private hasBoundary evidence providerContentExpired regionSetByUser
    }
    error { code message fieldErrors { field message } }
  }
}"""

AREA = """
query($id: ID!) {
  area(id: $id) { id name private readiness { basis } }
}"""


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def _confirm(h: Harness, token: str, **input_: Any) -> dict[str, Any]:
    payload = {"idempotencyKey": "key-location-00000001", "extent": "REFERENCE_POINT", **input_}
    result: dict[str, Any] = h.gql(CONFIRM, {"input": payload}, token)["data"]["confirmLocation"]
    return result


def test_ambiguous_name_returns_candidates_and_a_question(h: Harness) -> None:
    body = h.gql(RESOLVE, {"text": "Koramangala"}, "t-guest")
    assert "errors" not in body, body
    r = body["data"]["resolveLocation"]
    assert r["provider"] == "fixture"
    assert r["needsClarification"] is True
    assert len(r["candidates"]) >= 2
    assert "Which one" in r["question"]
    anonymous = h.gql(RESOLVE, {"text": "Koramangala"})
    assert anonymous["errors"][0]["extensions"]["code"] == "UNAUTHENTICATED"


def test_search_outside_india_confirms_with_its_own_region_settings(h: Harness) -> None:
    [nairobi] = h.gql(RESOLVE, {"text": "Nairobi"}, "t-guest")["data"]["resolveLocation"][
        "candidates"
    ]
    assert (nairobi["countryCode"], nairobi["scope"]) == ("KE", "LOCALITY")
    result = _confirm(
        h,
        "t-guest",
        origin="PLACE_SEARCH",
        placeId=nairobi["placeId"],
        name=nairobi["name"],
        latitude=nairobi["latitude"],
        longitude=nairobi["longitude"],
        countryCode="KE",
        types=["locality"],
    )
    assert result["error"] is None, result
    area = result["area"]
    assert (area["timezone"], area["currency"], area["unitSystem"]) == (
        "Africa/Nairobi",
        "KES",
        "METRIC",
    )
    assert (area["extent"], area["hasBoundary"], area["private"]) == (
        "REFERENCE_POINT",
        False,
        False,
    )
    assert area["evidence"] == "SYNTHETIC"
    readiness = h.gql(AREA, {"id": area["id"]}, "t-guest2")["data"]["area"]["readiness"]
    assert readiness["basis"] == "USER_INPUT"


def test_custom_location_is_private_and_validated(h: Harness) -> None:
    custom = {
        "origin": "CUSTOM",
        "name": "Our well",
        "latitude": "39.78",
        "longitude": "-89.65",
        "countryCode": "US",
        "extent": "USER_RADIUS",
        "radiusMeters": 2500,
    }
    created = _confirm(h, "t-guest", **custom)["area"]
    assert (created["unitSystem"], created["private"], created["radiusMeters"]) == (
        "US_CUSTOMARY",
        True,
        2500,
    )
    assert h.gql(AREA, {"id": created["id"]}, "t-guest")["data"]["area"]["private"] is True
    other = h.gql(AREA, {"id": created["id"]}, "t-guest2")
    assert other["errors"][0]["extensions"]["code"] == "NOT_FOUND"

    bad = _confirm(
        h,
        "t-guest",
        **{**custom, "radiusMeters": 80_000},
        idempotencyKey="key-location-00000002",
    )
    assert bad["error"]["code"] == "VALIDATION_FAILED"
    assert bad["error"]["fieldErrors"][0]["field"] == "radiusMeters"


def test_catalogue_area_keeps_its_reviewed_boundary(h: Harness) -> None:
    body = h.gql(
        "query($id: ID!) { area(id: $id) { origin extent hasBoundary private currency } }",
        {"id": AREA_ID},
    )
    assert body["data"]["area"] == {
        "origin": "CATALOGUE",
        "extent": "REVIEWED_BOUNDARY",
        "hasBoundary": True,
        "private": False,
        "currency": "INR",
    }


REGION = """
query($lat: DecimalString!, $lon: DecimalString!, $country: String!) {
  regionSettings(latitude: $lat, longitude: $lon, countryCode: $country) {
    currency currencyOptions currencyCertain timezone timezoneOptions timezoneCertain unitSystem
  }
}"""


def test_region_preview_flags_uncertainty_and_a_correction_is_recorded(h: Harness) -> None:
    bt = h.gql(REGION, {"lat": "27.47", "lon": "89.64", "country": "BT"}, "t-guest")
    r = bt["data"]["regionSettings"]
    assert (r["currencyOptions"], r["currencyCertain"]) == (["INR", "BTN"], False)
    assert (r["timezone"], r["timezoneCertain"]) == ("Asia/Thimphu", True)
    anonymous = h.gql(REGION, {"lat": "1", "lon": "1", "country": "KE"})
    assert anonymous["errors"][0]["extensions"]["code"] == "UNAUTHENTICATED"
    area = _confirm(
        h,
        "t-guest",
        origin="CUSTOM",
        name="Thimphu tank",
        latitude="27.47",
        longitude="89.64",
        countryCode="BT",
        currency="BTN",
    )["area"]
    assert (area["currency"], area["regionSetByUser"]) == ("BTN", ["currency"])


def test_extent_is_required_by_the_contract(h: Harness) -> None:
    body = h.gql(
        CONFIRM,
        {
            "input": {
                "origin": "CUSTOM",
                "name": "x",
                "latitude": "1",
                "longitude": "1",
                "countryCode": "KE",
                "idempotencyKey": "key-location-00000009",
            }
        },
        "t-guest",
    )
    assert "extent" in body["errors"][0]["message"]


def test_a_private_location_stays_hidden_in_shared_community_reports(h: Harness) -> None:
    community = create_community(h, "t-alice", "Lake Road residents")
    assert join(h, "t-bob", community["id"])["error"] is None
    secret = {
        "origin": "CUSTOM",
        "name": "My house",
        "latitude": "12.9351234",
        "longitude": "77.6245678",
        "countryCode": "IN",
        "formattedAddress": "12 Secret Lane",
    }
    area = _confirm(h, "t-alice", **secret)["area"]
    session = ready_session(
        h, "t-alice", "key-session-private-01", areaId=area["id"], communityId=community["id"]
    )
    report = finalize(h, "t-alice", session["id"], "key-report-private-01")["report"]
    assert report["communityId"] == community["id"]

    query = "query($id: ID!) { report(id: $id) { id area { id name formattedAddress } } }"
    seen = h.gql(query, {"id": report["id"]}, "t-bob")
    assert seen["data"]["report"] == {"id": report["id"], "area": None}
    hidden = h.gql(AREA, {"id": area["id"]}, "t-bob")
    message = hidden["errors"][0]["message"]
    assert hidden["errors"][0]["extensions"]["code"] == "NOT_FOUND"
    assert not any(v in message for v in ("12.935", "77.624", "Secret", "My house"))
    owner = h.gql(query, {"id": report["id"]}, "t-alice")["data"]["report"]["area"]
    assert owner["formattedAddress"] == "12 Secret Lane"

    refused = h.gql(
        """mutation($input: CreateCommunityInput!) {
          createCommunity(input: $input) { community { id } error { code message } } }""",
        {
            "input": {
                "name": "Secret club",
                "areaId": area["id"],
            "reportId": report["id"],
            "contactName": "Owner",
                "idempotencyKey": "key-comm-p-0001",
            }
        },
        "t-alice",
    )["data"]["createCommunity"]
    assert refused["community"] is None and refused["error"]["code"] == "VALIDATION_FAILED"
