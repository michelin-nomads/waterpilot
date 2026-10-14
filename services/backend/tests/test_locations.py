"""Choosing a location (ADR 0009): candidates and clarification, worldwide confirmation,
region settings, privacy of device and typed-in locations, and the user-input route."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from conftest import LOCAL_OK, PILOT_OK, LoadSettings
from waterlens.adapters.catalogue_synthetic import synthetic_area_catalogue
from waterlens.adapters.factory import build_place_search
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.places_fixture import FixturePlaceSearch
from waterlens.adapters.places_google import FIELD_MASK, GooglePlaceSearch
from waterlens.adapters.store_memory import MemoryStore
from waterlens.application.identity import AccountKind, Principal, RequestContext
from waterlens.application.ports import NoPlaceSearch, PlaceSearchUnavailable
from waterlens.application.services import Deps, Services
from waterlens.config import ConfigError
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.location import (
    AreaOrigin,
    ExtentKind,
    GeographicScope,
    PlaceCandidate,
    UnitSystem,
    country_names,
    currency_for,
    radius_bbox,
    scope_from_types,
    timezone_at,
    unit_system_for,
)
from waterlens.domain.planning import PlanningMode
from waterlens.domain.readiness import AssessmentBasis, InputId
from waterlens.domain.values import EvidenceQuality

NOW = datetime(2026, 10, 10, 6, 0, tzinfo=UTC)
ANA = Principal("ana", AccountKind.GUEST, "anonymous", NOW)
BEN = Principal("ben", AccountKind.PERMANENT, "password", NOW)


class GoogleIds(FixturePlaceSearch):
    provider = "google"


def services(places: Any = None) -> Services:
    store = MemoryStore(areas=synthetic_area_catalogue())
    return Services.build(
        Deps(
            store=store,
            clock=lambda: NOW,
            jobs=MemoryJobQueue(),
            places=places if places is not None else FixturePlaceSearch(),
        )
    )


def key(label: str) -> str:
    return f"test-key-{label}".ljust(16, "0")


def ctx(who: Principal | None = ANA) -> RequestContext:
    return RequestContext("r", who)


def candidate_input(c: PlaceCandidate, **over: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "origin": AreaOrigin.PLACE_SEARCH,
        "place_id": c.place_id,
        "name": c.name,
        "formatted_address": c.formatted_address,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "country_code": c.country_code,
        "admin": c.admin.model_dump(),
        "types": list(c.types),
        "extent": ExtentKind.REFERENCE_POINT,
    }
    return data | over


def custom_input(**over: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "origin": AreaOrigin.CUSTOM,
        "name": "Our village well",
        "latitude": "44.97",
        "longitude": "-93.26",
        "country_code": "US",
        "extent": ExtentKind.REFERENCE_POINT,
    }
    return data | over


def field_errors(err: pytest.ExceptionInfo[DomainError]) -> dict[str, str]:
    return {f.field: f.message for f in err.value.field_errors}


# ------------------------------------------------------------------ domain


def test_scope_comes_from_the_broadest_administrative_type() -> None:
    assert scope_from_types(("locality", "political")) is GeographicScope.LOCALITY
    assert scope_from_types(("sublocality_level_1",)) is GeographicScope.SUBLOCALITY
    assert scope_from_types(("neighborhood",)) is GeographicScope.NEIGHBOURHOOD
    assert scope_from_types(("street_address",)) is GeographicScope.POINT
    assert scope_from_types(()) is GeographicScope.POINT


def test_region_settings_are_derived_per_country_not_from_language() -> None:
    assert (currency_for("IN"), unit_system_for("IN")) == ("INR", UnitSystem.METRIC)
    assert (currency_for("KE"), unit_system_for("KE")) == ("KES", UnitSystem.METRIC)
    assert (currency_for("US"), unit_system_for("US")) == ("USD", UnitSystem.US_CUSTOMARY)
    assert currency_for("AQ") is None  # CLDR lists no tender: unknown, never guessed
    assert timezone_at(-1.2864, 36.8172) == "Africa/Nairobi"
    assert timezone_at(12.9352, 77.6245) == "Asia/Kolkata"
    assert timezone_at(-12.0464, -77.0428) == "America/Lima"


def test_country_list_is_iso_codes_only() -> None:
    names = country_names()
    assert names["IN"] == "India" and names["KE"] == "Kenya"
    assert not {"EU", "UN", "ZZ"} & set(names)
    assert all(len(code) == 2 for code in names)


def test_radius_extent_is_a_box_around_the_point_and_refuses_poles() -> None:
    box = radius_bbox(0.0, 0.0, 1113)
    assert box == pytest.approx((-0.01, -0.01, 0.01, 0.01), abs=1e-4)
    with pytest.raises(ValueError, match="pole"):
        radius_bbox(89.9, 0.0, 50_000)


# ------------------------------------------------------------------ resolution


def test_koramangala_gives_candidates_and_a_question_never_a_default() -> None:
    result = services().locations.resolve(ctx(), "Koramangala")
    assert [c.place_id for c in result.candidates] == [
        "fixture:koramangala",
        "fixture:koramangala-1st-block",
    ]
    assert result.needs_clarification
    assert "2 places" in result.question


def test_one_match_still_asks_for_confirmation() -> None:
    result = services().locations.resolve(ctx(), "Nairobi")
    assert [c.country_code for c in result.candidates] == ["KE"]
    assert not result.needs_clarification
    assert result.question.startswith("Is this the place you mean")


def test_ambiguous_names_outside_india_are_also_clarified() -> None:
    result = services().locations.resolve(ctx(), "springfield")
    assert {c.admin.admin1 for c in result.candidates} == {"Illinois", "Massachusetts"}
    assert result.needs_clarification


def test_no_match_points_to_typing_the_location() -> None:
    result = services().locations.resolve(ctx(), "Atlantis")
    assert result.candidates == ()
    assert "enter the location yourself" in result.question


def test_lookups_need_a_signed_in_caller_and_bounded_text() -> None:
    with pytest.raises(DomainError) as err:
        services().locations.resolve(ctx(None), "Nairobi")
    assert err.value.code is ErrorCode.UNAUTHENTICATED
    with pytest.raises(DomainError) as err:
        services().locations.resolve(ctx(), "x")
    assert "text" in field_errors(err)


def test_missing_provider_is_reported_not_faked() -> None:
    with pytest.raises(DomainError) as err:
        services(NoPlaceSearch()).locations.resolve(ctx(), "Nairobi")
    assert err.value.code is ErrorCode.SERVICE_UNAVAILABLE
    assert services(NoPlaceSearch()).locations.reverse(ctx(), "1", "1") == ()


def test_reverse_lookup_finds_nearby_fixture_places_only() -> None:
    near = services().locations.reverse(ctx(), "12.93", "77.62")
    assert near[0].place_id in {"fixture:koramangala", "fixture:koramangala-1st-block"}
    assert services().locations.reverse(ctx(), "0", "0") == ()


# ------------------------------------------------------------------ confirmation


def test_confirming_a_place_outside_india_derives_its_region_settings() -> None:
    s = services()
    (nairobi,) = s.locations.resolve(ctx(), "Nairobi").candidates
    area = s.locations.confirm(ctx(), candidate_input(nairobi), key("k1"))
    assert (area.country_code, area.timezone, area.currency) == ("KE", "Africa/Nairobi", "KES")
    assert area.unit_system is UnitSystem.METRIC
    assert area.scope is GeographicScope.LOCALITY
    assert area.extent is ExtentKind.REFERENCE_POINT and area.boundary_bbox is None
    assert area.owner_uid is None and area.place_id == "fixture:nairobi"
    assert area.evidence is EvidenceQuality.SYNTHETIC  # fixture data is labelled
    assert area.provider_expires_at is None
    again = s.locations.confirm(ctx(), candidate_input(nairobi), key("k1"))
    other_key = s.locations.confirm(ctx(BEN), candidate_input(nairobi), key("k2"))
    assert again.id == area.id == other_key.id


def test_google_content_expires_after_thirty_days_and_fixture_ids_are_refused() -> None:
    s = services(GoogleIds())
    (lima,) = s.locations.resolve(ctx(), "Lima").candidates
    with pytest.raises(DomainError) as err:
        s.locations.confirm(ctx(), candidate_input(lima), key("k1"))
    assert "placeId" in field_errors(err)
    area = s.locations.confirm(ctx(), candidate_input(lima, place_id="google:ChIJabc"), key("k2"))
    assert area.provider_expires_at == NOW + timedelta(days=30)
    assert area.evidence is EvidenceQuality.PROVISIONAL


def test_custom_and_device_locations_are_private_to_their_owner() -> None:
    s = services()
    area = s.locations.confirm(ctx(), custom_input(), key("k1"))
    assert area.owner_uid == "ana" and area.currency == "USD"
    assert area.unit_system is UnitSystem.US_CUSTOMARY
    assert area.timezone == "America/Chicago"
    assert s.areas.get(area.id, "ana").id == area.id
    with pytest.raises(DomainError) as err:
        s.areas.get(area.id, "ben")
    assert err.value.code is ErrorCode.NOT_FOUND
    with pytest.raises(DomainError):
        s.areas.get(area.id, None)
    assert s.areas.get_many([area.id], "ben") == {}

    session = s.sessions.create(ctx(BEN), {"mode": PlanningMode.TRADITIONAL}, key("s1"))
    with pytest.raises(DomainError) as err:
        s.sessions.update(ctx(BEN), session.id, 1, {"area_id": area.id})
    assert err.value.field == "areaId"
    mine = s.sessions.create(
        ctx(), {"mode": PlanningMode.TRADITIONAL, "area_id": area.id}, key("s2")
    )
    assert mine.area_id == area.id


def test_device_location_keeps_its_accuracy_and_a_private_community_is_refused() -> None:
    s = services()
    area = s.locations.confirm(
        ctx(BEN),
        custom_input(origin=AreaOrigin.GEOLOCATION, name="My location", accuracy_meters=2500),
        key("k1"),
    )
    assert area.accuracy_m == 2500 and area.owner_uid == "ben"
    with pytest.raises(DomainError) as err:
        s.communities.create(
            ctx(BEN),
            {
                "name": "Well users",
                "area_id": area.id,
                "report_id": new_id(IdKind.REPORT),
                "contact_name": "Ben",
            },
            key("c1"),
        )
    assert "private" in err.value.message


def test_a_radius_is_a_user_defined_extent() -> None:
    s = services()
    area = s.locations.confirm(
        ctx(), custom_input(extent=ExtentKind.USER_RADIUS, radius_meters=2000), key("k1")
    )
    assert area.extent is ExtentKind.USER_RADIUS and area.radius_m == 2000
    assert area.boundary_bbox is not None
    point = s.locations.confirm(ctx(), custom_input(), key("k2"))
    assert point.id != area.id  # a different extent is a different area


@pytest.mark.parametrize(
    ("over", "field"),
    [
        ({"latitude": "91"}, "latitude"),
        ({"longitude": "10.123456789"}, "longitude"),
        ({"latitude": "north"}, "latitude"),
        ({"country_code": "XX"}, "countryCode"),
        ({"accuracy_meters": 10}, "accuracyMeters"),
        ({"place_id": "fixture:nairobi"}, "placeId"),
        ({"extent": ExtentKind.USER_RADIUS}, "radiusMeters"),
        ({"extent": ExtentKind.USER_RADIUS, "radius_meters": 60_000}, "radiusMeters"),
        ({"radius_meters": 500}, "radiusMeters"),
        ({"extent": ExtentKind.REVIEWED_BOUNDARY}, "extent"),
        ({"origin": AreaOrigin.CATALOGUE}, "origin"),
        ({"name": "   "}, "name"),
    ],
)
def test_invalid_locations_get_field_errors(over: dict[str, Any], field: str) -> None:
    with pytest.raises(DomainError) as err:
        services().locations.confirm(ctx(), custom_input(**over), key("k1"))
    assert field in field_errors(err)


def test_unsupported_location_routes_to_a_user_input_assessment() -> None:
    s = services()
    (nairobi,) = s.locations.resolve(ctx(), "Nairobi").candidates
    area = s.locations.confirm(ctx(), candidate_input(nairobi), key("k1"))
    readiness = s.readiness.assess(ctx(), area.id, None)
    assert readiness.basis is AssessmentBasis.USER_INPUT
    assert {c.state.value for c in readiness.capabilities} == {"unavailable"}


def test_name_search_never_returns_chosen_locations() -> None:
    s = services()
    s.locations.confirm(ctx(), custom_input(name="Synth private"), key("k1"))
    from waterlens.application.pagination import PageArgs

    names = [a.name for a in s.areas.search("Synth", PageArgs(first=10)).items]
    assert names == ["Synthville (SYNTHETIC — not a real place)"]


# ------------------------------------------------------------------ adapters and config


def _google_place(**over: Any) -> dict[str, Any]:
    place: dict[str, Any] = {
        "id": "ChIJ123",
        "displayName": {"text": "Lima"},
        "formattedAddress": "Lima, Peru",
        "location": {"latitude": -12.0463731, "longitude": -77.042754},
        "viewport": {
            "low": {"latitude": -12.3, "longitude": -77.2},
            "high": {"latitude": -11.8, "longitude": -76.8},
        },
        "types": ["locality", "political"],
        "addressComponents": [
            {"longText": "Lima", "shortText": "Lima", "types": ["locality", "political"]},
            {"longText": "Peru", "shortText": "PE", "types": ["country", "political"]},
        ],
    }
    return place | over


def test_google_text_search_sends_a_field_mask_and_normalises_results() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        bad = {"id": "broken"}  # no location: dropped, never guessed
        crossing = _google_place(
            id="ChIJfiji",
            viewport={
                "low": {"latitude": -18, "longitude": 177},
                "high": {"latitude": -16, "longitude": -179},
            },
        )
        return httpx.Response(200, json={"places": [_google_place(), bad, crossing]})

    found = GooglePlaceSearch("key-123", httpx.MockTransport(handler)).search("Lima", 5)
    (request,) = seen
    assert request.headers["X-Goog-FieldMask"] == FIELD_MASK
    assert "places.addressComponents" in FIELD_MASK and "*" not in FIELD_MASK
    assert request.headers["X-Goog-Api-Key"] == "key-123"
    assert json.loads(request.content) == {"textQuery": "Lima", "pageSize": 5, "languageCode": "en"}
    assert [c.place_id for c in found] == ["google:ChIJ123", "google:ChIJfiji"]
    lima = found[0]
    assert (lima.country_code, lima.admin.country_name, lima.latitude) == (
        "PE",
        "Peru",
        "-12.0463731",
    )
    assert lima.viewport == (-77.2, -12.3, -76.8, -11.8)
    assert found[1].viewport is None


def test_google_failures_are_unavailable_not_empty() -> None:
    failing = httpx.MockTransport(lambda r: httpx.Response(403, json={}))
    with pytest.raises(PlaceSearchUnavailable):
        GooglePlaceSearch("k", failing).search("Lima", 5)

    def offline(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    with pytest.raises(PlaceSearchUnavailable):
        GooglePlaceSearch("k", httpx.MockTransport(offline)).search("Lima", 5)


def test_local_mode_uses_the_fixture_and_refuses_a_places_key(load_settings: LoadSettings) -> None:
    assert build_place_search(load_settings(LOCAL_OK)).provider == "fixture"
    with pytest.raises(ConfigError, match="WL_PLACES_SERVER_KEY"):
        load_settings({**LOCAL_OK, "WL_PLACES_SERVER_KEY": "abc"})


def test_pilot_uses_google_only_with_a_server_key(load_settings: LoadSettings) -> None:
    unkeyed = build_place_search(load_settings(PILOT_OK))
    assert isinstance(unkeyed, NoPlaceSearch)
    assert unkeyed.provider == "google"  # browser Google ids stay valid; fixture ids never
    keyed = load_settings({**PILOT_OK, "WL_PLACES_SERVER_KEY": "abc"})
    assert build_place_search(keyed).provider == "google"
    assert "abc" not in repr(keyed)


def test_pilot_without_a_server_key_accepts_browser_google_places_only() -> None:
    s = services(NoPlaceSearch("google"))
    lima = FixturePlaceSearch().search("Lima", 1)[0]
    google = candidate_input(lima, place_id="google:ChIJlima")
    area = s.locations.confirm(ctx(), google, key("pilot1"))
    assert area.place_id == "google:ChIJlima"
    assert area.evidence is EvidenceQuality.PROVISIONAL
    with pytest.raises(DomainError) as err:
        s.locations.confirm(ctx(), candidate_input(lima), key("pilot2"))
    assert "placeId" in field_errors(err)


def test_the_extent_is_always_an_explicit_choice() -> None:
    data = custom_input()
    del data["extent"]
    with pytest.raises(DomainError) as err:
        services().locations.confirm(ctx(), data, key("ext1"))
    assert err.value.code is ErrorCode.VALIDATION_FAILED
    assert "extent" in field_errors(err)


def test_a_confirmation_never_rewrites_a_shared_area() -> None:
    s = services()
    nairobi = s.locations.resolve(ctx(), "Nairobi").candidates[0]
    original = s.locations.confirm(ctx(ANA), candidate_input(nairobi), key("sh1"))
    forged = s.locations.confirm(
        ctx(BEN),
        candidate_input(nairobi, name="Not Nairobi", latitude="10", longitude="10"),
        key("sh2"),
    )
    assert forged.id != original.id
    kept = s.areas.get(original.id, "ana")
    assert (kept.name, kept.centroid_lat) == ("Nairobi", nairobi.latitude)


def test_region_settings_flag_uncertainty_and_accept_corrections() -> None:
    s = services()
    bhutan = s.locations.region(ctx(), "27.47", "89.64", "BT")
    assert bhutan.currency_options == ("INR", "BTN") and not bhutan.currency_certain
    us = s.locations.region(ctx(), "44.97", "-93.26", "US")
    assert us.timezone == "America/Chicago" and not us.timezone_certain
    assert len(us.timezone_options) > 5
    kenya = s.locations.region(ctx(), "-1.29", "36.82", "KE")
    assert kenya.currency_certain and kenya.timezone_certain
    with pytest.raises(DomainError):
        s.locations.region(ctx(None), "1", "1", "KE")

    area = s.locations.confirm(
        ctx(),
        custom_input(latitude="27.47", longitude="89.64", country_code="BT", currency="BTN"),
        key("rg1"),
    )
    assert (area.currency, area.timezone, area.region_set_by_user) == (
        "BTN",
        "Asia/Thimphu",
        ("currency",),
    )
    same = s.locations.confirm(ctx(), custom_input(timezone="America/Chicago"), key("rg2"))
    assert same.region_set_by_user == ()  # choosing the inferred value is not a correction
    with pytest.raises(DomainError) as err:
        s.locations.confirm(
            ctx(), custom_input(timezone="Mars/Olympus", currency="XYZ"), key("rg3")
        )
    assert set(field_errors(err)) == {"timezone", "currency"}


def test_values_entered_for_a_previous_location_do_not_count_for_the_new_one() -> None:
    s = services()
    first = s.locations.confirm(ctx(), custom_input(), key("mv1"))
    session = s.sessions.create(
        ctx(), {"mode": PlanningMode.TRADITIONAL, "area_id": first.id}, key("mv2")
    )
    s.readiness.record_manual_input(
        ctx(),
        {
            "session_id": session.id,
            "input": InputId.POPULATION,
            "value": "500",
            "unit": "people",
            "as_of": "2026-10-01",
            "note": "Village count",
        },
        key("mv3"),
    )
    population = next(
        i
        for i in s.readiness.assess(ctx(), first.id, session.id).inputs
        if i.input.value == "population"
    )
    assert population.manual_value is not None
    second = s.locations.confirm(ctx(), custom_input(name="Another well"), key("mv4"))
    current = s.sessions.get(ctx(), session.id)  # recording bumped the session
    s.sessions.update(ctx(), session.id, current.version, {"area_id": second.id})
    population = next(
        i
        for i in s.readiness.assess(ctx(), second.id, session.id).inputs
        if i.input.value == "population"
    )
    assert population.manual_value is None
