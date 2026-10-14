"""Nearby community discovery: geohash candidates, exact distance, dedupe, bounded pages.

Also collected by ``tests/emulator/test_firestore_parity.py`` against Firestore."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import NOW, Harness, make_harness
from waterlens.application.services.communities import NEARBY_CANDIDATES_PER_CELL
from waterlens.domain import geo
from waterlens.domain.communities import Community, CommunityStatus
from waterlens.domain.ids import IdKind, new_id

NEARBY = """
query($near: NearbyCommunitiesInput!, $first: Int, $after: String) {
  nearbyCommunities(near: $near, first: $first, after: $after) {
    nodes { distanceMeters community { id name viewerMembership { id } } }
    pageInfo { hasNextPage endCursor }
    candidatesTruncated
  }
}"""


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path)


def place(h: Harness, name: str, lat: str, lon: str, **extra: Any) -> str:
    community = Community(
        id=new_id(IdKind.COMMUNITY),
        name=name,
        latitude=lat,
        longitude=lon,
        geohash=geo.encode(float(lat), float(lon)),
        created_at=NOW,
        updated_at=NOW,
        **extra,
    )
    h.store.transaction(lambda: h.store.communities.insert(community))
    return community.id


def nearby(
    h: Harness, lat: str, lon: str, radius: int, first: int | None = None, after: str | None = None
) -> dict[str, Any]:
    body = h.gql(
        NEARBY,
        {
            "near": {"latitude": lat, "longitude": lon, "radiusMeters": radius},
            "first": first,
            "after": after,
        },
    )
    assert "errors" not in body, body
    return body["data"]["nearbyCommunities"]  # type: ignore[no-any-return]


def test_nearest_first_within_the_radius_only(h: Harness) -> None:
    # (0, 0) is the corner of four top-level geohash cells: neighbours must be searched.
    place(h, "Across the equator", "-0.0100", "-0.0100")
    place(h, "Next door", "0.0010", "0.0010")
    place(h, "Edge of town", "0.0300", "-0.0200")
    place(h, "Too far", "0.1000", "0.1000")
    place(h, "Closed group", "0.0011", "0.0011", status=CommunityStatus.ARCHIVED)
    place(h, "London", "51.5072", "-0.1276")
    out = nearby(h, "0", "0", 5_000)
    assert [n["community"]["name"] for n in out["nodes"]] == [
        "Next door",
        "Across the equator",
        "Edge of town",
    ]
    assert [n["distanceMeters"] for n in out["nodes"]] == [157, 1573, 4009]
    assert out["candidatesTruncated"] is False
    assert all(n["community"]["viewerMembership"] is None for n in out["nodes"])


def test_pages_are_bounded_and_cursors_bind_the_search(h: Harness) -> None:
    ids = [place(h, f"Group {i}", f"0.00{i}", "0") for i in range(1, 6)]
    first = nearby(h, "0", "0", 2_000, first=2)
    assert first["pageInfo"]["hasNextPage"] is True
    rest = nearby(h, "0", "0", 2_000, first=10, after=first["pageInfo"]["endCursor"])
    got = [n["community"]["id"] for n in first["nodes"] + rest["nodes"]]
    assert got == ids and rest["pageInfo"]["hasNextPage"] is False
    replay = h.gql(
        NEARBY,
        {
            "near": {"latitude": "0", "longitude": "0", "radiusMeters": 3_000},
            "after": first["pageInfo"]["endCursor"],
        },
    )
    assert replay["errors"][0]["extensions"]["code"] == "VALIDATION_FAILED"


def test_the_antimeridian_is_not_a_wall(h: Harness) -> None:
    place(h, "East side", "10.0000", "179.9990")
    out = nearby(h, "10", "-179.9990", 1_000)
    assert [n["community"]["name"] for n in out["nodes"]] == ["East side"]
    assert out["nodes"][0]["distanceMeters"] == 219


def test_a_created_community_is_discoverable_at_its_location(h: Harness) -> None:
    from api.test_graphql_behaviour import create_community

    created = create_community(h, "t-alice", "Synth lake")["id"]
    out = nearby(h, "0", "0", 100)
    assert [(n["community"]["id"], n["distanceMeters"]) for n in out["nodes"]] == [(created, 0)]


def test_dense_cells_report_truncated_candidates(h: Harness) -> None:
    for i in range(NEARBY_CANDIDATES_PER_CELL + 1):
        place(h, f"Dense {i}", "0.0001", "0.0001")
    out = nearby(h, "0", "0", 1_000, first=50)
    assert out["candidatesTruncated"] is True
    assert len(out["nodes"]) == 50


@pytest.mark.parametrize(
    ("lat", "lon", "radius"),
    [("0", "0", 50), ("0", "0", 60_000), ("91", "0", 1_000)],
)
def test_invalid_searches_are_validation_errors(
    h: Harness, lat: str, lon: str, radius: int
) -> None:
    body = h.gql(NEARBY, {"near": {"latitude": lat, "longitude": lon, "radiusMeters": radius}})
    assert body["errors"][0]["extensions"]["code"] == "VALIDATION_FAILED"
