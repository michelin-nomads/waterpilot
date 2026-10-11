"""Firestore adapter against the emulator: the shared ``Store`` contract, concurrent
mutations through the real services, deny-all browser rules and the local factory."""

from __future__ import annotations

import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
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
from graphql_harness import AREA_ID, NOW
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
from waterlens.domain.planning import SessionStatus

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
