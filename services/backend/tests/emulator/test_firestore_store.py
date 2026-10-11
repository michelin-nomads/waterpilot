"""Firestore adapter against the emulator: the shared ``Store`` contract, concurrent
mutations through the real services, deny-all browser rules and the local factory."""

from __future__ import annotations

import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from fractions import Fraction
from pathlib import Path
from typing import Any

import httpx
import pytest
from emulator_client import (  # noqa: F401 - fixtures are injected by name
    AuthEmulator,
    emu,
    emulator_host,
)
from firestore_support import (
    FIRESTORE_HOST,
    PROJECT,
    firestore_store,  # noqa: F401 - fixture injected by name
    require_firestore_emulator,
    reset_firestore,
)

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import AREA_ID, NOW, seed_plan_option
from store_contract import StoreContract
from waterlens.adapters.catalogue_synthetic import SYNTHETIC_SCHEME_ID
from waterlens.adapters.factory import build_api_runtime
from waterlens.adapters.jobqueue_memory import MemoryJobQueue
from waterlens.adapters.store_firestore import FirestoreStore
from waterlens.application.identity import AccountKind, Principal, RequestContext
from waterlens.application.pagination import PageArgs, page_query
from waterlens.application.services import Deps, Services
from waterlens.domain.communities import CommunityStatus
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.impact import (
    ConnectivityEvidence,
    ImpactInputs,
    NearbyInput,
    QualityInput,
    SourcedValue,
    assess,
)
from waterlens.domain.impact_records import Citation, CitationKind, OptionImpact
from waterlens.domain.interventions import CATALOGUE
from waterlens.domain.options import compare_options, comparison_key
from waterlens.domain.planning import Goal, GoalFields, GoalKind, SessionStatus, SiteConstraints
from waterlens.domain.reports import Report
from waterlens.domain.scenario import Balance
from waterlens.domain.values import Unit

pytestmark = pytest.mark.emulator


@pytest.fixture
def store(firestore_store: FirestoreStore) -> FirestoreStore:  # noqa: F811
    return firestore_store


class TestFirestoreStore(StoreContract):
    pass


# --- concurrent mutations through the application services -----------------------------


def services(store: FirestoreStore) -> Services:
    return Services.build(Deps(store=store, clock=lambda: NOW, jobs=MemoryJobQueue()))


def ctx(uid: str) -> RequestContext:
    return RequestContext("req", Principal(uid, AccountKind.PERMANENT, "password", NOW))


def key(n: int) -> str:
    return f"concurrency-key-{n:08d}"


def race(calls: list[Callable[[], Any]]) -> list[Any]:
    """Start every call at the same moment; return results or the raised DomainError."""
    gate = threading.Barrier(len(calls))

    def run(call: Callable[[], Any]) -> Any:
        gate.wait()
        try:
            return call()
        except DomainError as err:
            return err

    with ThreadPoolExecutor(len(calls)) as pool:
        return list(pool.map(run, calls))


def active_members(s: Services, community_id: str) -> int:
    page = s.communities.members(ctx("alice"), community_id, PageArgs(first=50))
    return len(page.items)


def test_concurrent_joins_count_every_member_exactly_once(store: FirestoreStore) -> None:
    s = services(store)
    community = s.communities.create(ctx("alice"), {"name": "Lake friends"}, key(0))
    users = [f"user-{i}" for i in range(6)]
    results = race(
        [
            lambda u=u, i=i: s.communities.join(ctx(u), community.id, key(i + 1))  # type: ignore[misc]
            for i, u in enumerate(users)
        ]
    )
    assert not [r for r in results if isinstance(r, DomainError)], results
    assert s.communities.get(community.id).member_count == 7
    assert active_members(s, community.id) == 7


def test_one_user_joining_twice_at_once_is_one_membership(store: FirestoreStore) -> None:
    s = services(store)
    community = s.communities.create(ctx("alice"), {"name": "Lake friends"}, key(0))
    results = race(
        [
            lambda i=i: s.communities.join(ctx("bob"), community.id, key(10 + i))  # type: ignore[misc]
            for i in range(4)
        ]
    )
    assert not [r for r in results if isinstance(r, DomainError)], results
    assert len({r.id for r in results}) == 1
    assert s.communities.get(community.id).member_count == 2
    assert active_members(s, community.id) == 2


def test_join_and_leave_races_keep_the_counter_consistent(store: FirestoreStore) -> None:
    s = services(store)
    community = s.communities.create(ctx("alice"), {"name": "Lake friends"}, key(0))
    joined = {
        u: s.communities.join(ctx(u), community.id, key(20 + i))
        for i, u in enumerate(("bob", "carol", "dan"))
    }
    calls: list[Callable[[], Any]] = [
        lambda: s.communities.leave(ctx("bob"), community.id, joined["bob"].version),
        lambda: s.communities.leave(ctx("carol"), community.id, joined["carol"].version),
        lambda: s.communities.join(ctx("erin"), community.id, key(30)),
        lambda: s.communities.join(ctx("fay"), community.id, key(31)),
    ]
    results = race(calls)
    assert not [r for r in results if isinstance(r, DomainError)], results
    assert s.communities.get(community.id).member_count == active_members(s, community.id) == 4


def test_archive_racing_joins_never_admits_a_member_after_archive(
    store: FirestoreStore,
) -> None:
    s = services(store)
    community = s.communities.create(ctx("alice"), {"name": "Lake friends"}, key(0))

    def archive_latest() -> Any:
        """A coordinator retrying with the fresh version, as the UI does on conflict."""
        for _ in range(10):
            try:
                version = s.communities.get(community.id).version
                return s.communities.archive(ctx("alice"), community.id, version)
            except DomainError as err:
                if err.code is not ErrorCode.VERSION_CONFLICT:
                    raise
        raise AssertionError("archive never won")

    calls: list[Callable[[], Any]] = [
        archive_latest,
        *[
            lambda i=i: s.communities.join(ctx(f"late-{i}"), community.id, key(40 + i))
            for i in range(4)
        ],
    ]
    results = race(calls)
    assert not isinstance(results[0], DomainError), results[0]
    joins = results[1:]
    refused = [r for r in joins if isinstance(r, DomainError)]
    assert all(r.code is ErrorCode.ARCHIVED for r in refused)
    final = s.communities.get(community.id)
    assert final.status is CommunityStatus.ARCHIVED
    assert final.member_count == 1 + len(joins) - len(refused)
    with pytest.raises(DomainError) as late:
        s.communities.join(ctx("later"), community.id, key(50))
    assert late.value.code is ErrorCode.ARCHIVED


def test_conflicting_session_updates_let_exactly_one_win(store: FirestoreStore) -> None:
    s = services(store)
    session = s.sessions.create(ctx("alice"), {"mode": "traditional", "area_id": AREA_ID}, key(0))
    stages = ("goal", "compare", "make_it_happen", "track")
    results = race(
        [
            lambda st=st: s.sessions.update(ctx("alice"), session.id, 1, {"stage": st})  # type: ignore[misc]
            for st in stages
        ]
    )
    winners = [r for r in results if not isinstance(r, DomainError)]
    losers = [r for r in results if isinstance(r, DomainError)]
    assert len(winners) == 1 and winners[0].version == 2
    assert {e.code for e in losers} == {ErrorCode.VERSION_CONFLICT}
    assert s.sessions.get(ctx("alice"), session.id).stage == winners[0].stage


def test_a_selected_engine_option_round_trips_with_its_comparison(store: FirestoreStore) -> None:
    s = services(store)
    session = s.sessions.create(ctx("alice"), {"mode": "traditional", "area_id": AREA_ID}, key(9))
    legacy = store.plan_options.get(seed_plan_option(store, session.id, 1_000_000))
    assert legacy is not None and legacy.comparison_id is None
    engine = legacy.model_copy(
        update={
            "id": legacy.id[:-1] + ("A" if legacy.id[-1] != "A" else "B"),
            "comparison_id": "c" * 64,
            "engine_version": "options-1",
            "intervention_ids": ("efficient_fixtures", "greywater_reuse"),
        }
    )
    store.plan_options.add(engine)
    store.plan_options.add(engine)  # a retry writes the same document
    assert store.plan_options.get(engine.id) == engine
    listed = s.sessions.plan_options(ctx("alice"), session.id, PageArgs(first=10))
    assert {o.id for o in listed.items} == {legacy.id, engine.id}


def _wider_impact() -> OptionImpact:
    site = SiteConstraints.model_validate(
        {"scale": "building", "storage_space": True, "piped_supply": True, "groundwater_use": True}
    )
    g = GoalFields.model_validate(
        {
            "kind": "reduce_tanker_dependence",
            "target": {"mode": "absolute_level", "quantity": {"value": "0.2", "unit": "ratio"}},
            "site": site.model_dump(),
            "estimates": [
                {
                    "intervention_id": "leak_detection_and_repair",
                    "effects": [
                        {"key": "leakage_share", "low": "0.3", "high": "0.4"},
                        {"key": "recovered_share", "low": "0.6", "high": "0.8"},
                    ],
                },
                {
                    "intervention_id": "greywater_reuse",
                    "effects": [{"key": "reuse_share", "low": "0.3", "high": "0.4"}],
                },
            ],
        }
    )
    base = Balance(Fraction(1000), Fraction(700), Fraction(300), Fraction(730))
    key_ = comparison_key(baseline_id="bsl_A", goal=g, adjustments=())
    c = compare_options(
        key=key_, goal=g, base=base, adjustments=(), baseline_id="bsl_A", catalogue=CATALOGUE
    )
    source = Citation(kind=CitationKind.SOURCE, ref="snp_1", label="State groundwater board")
    evidence = ConnectivityEvidence.model_validate(
        {
            "id": "aq-unit-7",
            "system": "aquifer",
            "linkage": "linked",
            "unit_name": "Unit 7",
            "area_ids": [AREA_ID, "are_NEXT"],
            "basis": "mapped_boundary",
            "source_ids": ["src_atlas"],
            "method": "Test delineation",
            "as_of": "2025-03-01",
            "quality": "provisional",
            "uncertainty": "Test fixture only.",
        }
    )
    inputs = ImpactInputs(
        area_id=AREA_ID,
        area_name="Synthville",
        area_extent="Synthetic boundary.",
        site=site,
        abstraction=SourcedValue(Fraction(5000), date(2026, 9, 30), (source,)),
        groundwater_level=SourcedValue(Fraction(23, 2), date(2026, 9, 1), (source,)),
        water_quality=(
            QualityInput(
                "nitrate", Fraction(52), Unit.MG_PER_LITRE, date(2026, 8, 14), None, (source,)
            ),
        ),
        connectivity=(evidence,),
        nearby=(NearbyInput("Next ward", "com_NEXT", "are_NEXT", 900),),
    )
    reuse = next(o for o in c.options if "greywater_reuse" in o.intervention_ids)
    return assess(c, inputs, CATALOGUE).options[reuse.id]


def test_a_chosen_option_and_report_keep_the_wider_impact_through_firestore(
    store: FirestoreStore,
) -> None:
    s = services(store)
    session = s.sessions.create(ctx("alice"), {"mode": "traditional", "area_id": AREA_ID}, key(8))
    legacy = store.plan_options.get(seed_plan_option(store, session.id, 1_000_000))
    assert legacy is not None
    wider = _wider_impact()
    assert wider.false_resilience and wider.reviews and wider.context.nearby
    assert wider.context.water_quality
    chosen = legacy.model_copy(update={"impact": legacy.impact.model_copy(update={"wider": wider})})
    store.plan_options.add(chosen)
    stored = store.plan_options.get(chosen.id)
    assert stored is not None and stored.impact.wider == wider
    report = Report(
        id=new_id(IdKind.REPORT),
        owner_uid="alice",
        session_id=session.id,
        area_id=AREA_ID,
        plan_option_id=chosen.id,
        plan_name=chosen.name,
        title="Ward plan",
        goal=Goal(id=new_id(IdKind.GOAL), kind=GoalKind.REDUCE_TANKER_DEPENDENCE),
        finalized_at=NOW,
        impact=stored.impact,
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.reports.insert(report))
    assert store.reports.get(report.id) == report


def test_concurrent_session_starts_leave_one_active_session(store: FirestoreStore) -> None:
    s = services(store)
    results = race(
        [
            lambda i=i: s.sessions.create(ctx("alice"), {"mode": "agent"}, key(60 + i))  # type: ignore[misc]
            for i in range(4)
        ]
    )
    assert not [r for r in results if isinstance(r, DomainError)], results
    where = {"owner_uid": "alice", "status": SessionStatus.ACTIVE.value}
    active = store.sessions.page(where, page_query(10, None, where)).items
    assert len(active) == 1


def test_idempotent_replays_racing_each_other_create_one_record(store: FirestoreStore) -> None:
    s = services(store)
    results = race(
        [
            lambda: s.communities.create(ctx("alice"), {"name": "Same intent"}, key(70))
            for _ in range(4)
        ]
    )
    assert not [r for r in results if isinstance(r, DomainError)], results
    assert len({r.id for r in results}) == 1


# --- browser access is denied by the security rules --------------------------------------


def test_browser_clients_cannot_read_or_write_any_document(
    firestore_store: FirestoreStore,  # noqa: F811
    emu: AuthEmulator,  # noqa: F811
) -> None:
    s = services(firestore_store)
    session = s.sessions.create(ctx("alice"), {"mode": "agent"}, key(80))
    guest = emu.sign_up_guest()
    base = f"http://{FIRESTORE_HOST}/v1/projects/{PROJECT}/databases/(default)/documents"
    doc = f"{base}/planningSessions/{session.id}"
    for headers in ({}, {"Authorization": f"Bearer {guest.id_token}"}):
        assert httpx.get(doc, headers=headers).status_code == 403
        assert httpx.get(f"{base}/planningSessions", headers=headers).status_code == 403
        write = httpx.patch(
            doc, headers=headers, json={"fields": {"owner_uid": {"stringValue": "x"}}}
        )
        assert write.status_code == 403
        assert httpx.get(f"{base}/users/{guest.uid}", headers=headers).status_code == 403
    # The document exists: only the privileged emulator admin path can see it.
    assert httpx.get(doc, headers={"Authorization": "Bearer owner"}).status_code == 200


# --- the local factory uses the emulator store ------------------------------------------


def test_local_runtime_uses_the_firestore_emulator_with_synthetic_catalogue(
    load_settings: LoadSettings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    require_firestore_emulator()
    reset_firestore()
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", FIRESTORE_HOST)
    settings = load_settings(
        {
            **LOCAL_OK,
            "WL_FIRESTORE_EMULATOR_HOST": FIRESTORE_HOST,
            "WL_OBJECT_STORAGE_DIR": str(tmp_path / "objects"),
        }
    )
    runtime = build_api_runtime(settings)
    store = runtime.services.deps.store
    assert isinstance(store, FirestoreStore)
    assert store.funding_schemes.get(SYNTHETIC_SCHEME_ID) is not None
