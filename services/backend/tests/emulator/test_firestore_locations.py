"""Confirmed locations on the Firestore emulator: areas round-trip with their region
settings, private origins stay private, searches return catalogue areas only, and the
search query shape is index-checked by ``test_zz_firestore_indexes``."""

from __future__ import annotations

import pytest
from firestore_support import firestore_store  # noqa: F401 - fixture injected by name

from test_locations import ANA, BEN, NOW, candidate_input, ctx, key
from waterlens.adapters.catalogue_synthetic import SYNTHETIC_AREA_ID
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.places_fixture import FixturePlaceSearch
from waterlens.adapters.store_firestore import FirestoreStore
from waterlens.application.pagination import PageArgs
from waterlens.application.services import Deps, Services
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.location import AreaOrigin, ExtentKind, UnitSystem

pytestmark = pytest.mark.emulator


def test_confirmed_areas_on_firestore(firestore_store: FirestoreStore) -> None:  # noqa: F811
    store = firestore_store
    services = Services.build(
        Deps(store=store, clock=lambda: NOW, jobs=MemoryJobQueue(), places=FixturePlaceSearch())
    )
    lima = services.locations.resolve(ctx(ANA), "Lima").candidates[0]
    area = services.locations.confirm(
        ctx(ANA),
        candidate_input(lima, extent=ExtentKind.USER_RADIUS, radius_meters=2000),
        key("fs1"),
    )
    stored = store.areas.get(area.id)
    assert stored == area  # nested admin context and bbox survive the round trip
    assert (stored.country_code, stored.currency, stored.unit_system) == (
        "PE",
        "PEN",
        UnitSystem.METRIC,
    )
    assert stored.boundary_bbox is not None

    custom = services.locations.confirm(
        ctx(BEN),
        {
            "origin": AreaOrigin.CUSTOM,
            "name": "Our well",
            "latitude": "39.78",
            "longitude": "-89.65",
            "country_code": "US",
            "extent": ExtentKind.REFERENCE_POINT,
        },
        key("fs2"),
    )
    assert services.areas.get(custom.id, "ben").unit_system is UnitSystem.US_CUSTOMARY
    with pytest.raises(DomainError) as err:
        services.areas.get(custom.id, "ana")
    assert err.value.code is ErrorCode.NOT_FOUND

    assert [a.id for a in services.areas.search("Synth", PageArgs(first=10)).items] == [
        SYNTHETIC_AREA_ID
    ]
    assert services.areas.search("Lima", PageArgs(first=10)).items == ()
    assert services.areas.search("Our", PageArgs(first=10)).items == ()
