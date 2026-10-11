"""The ``Store`` contract (application/repositories.py), run against every adapter.

Subclass ``StoreContract`` and provide a ``store`` fixture: the in-memory store in the
default suite, the Firestore emulator in ``tests/emulator``.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest

from graphql_harness import NOW
from waterlens.application.pagination import page_query
from waterlens.application.repositories import IdempotencyRecord
from waterlens.domain import geo
from waterlens.domain.communities import Community, CommunityStatus
from waterlens.domain.errors import DomainError, ErrorCode
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.planning import PlanningMode, PlanningSession, SessionStatus


def session(owner: str, minutes: int = 0, **extra: Any) -> PlanningSession:
    at = NOW + timedelta(minutes=minutes)
    return PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=owner,
        mode=PlanningMode.TRADITIONAL,
        created_at=at,
        updated_at=at,
        **extra,
    )


def community(lat: str, lon: str, **extra: Any) -> Community:
    return Community(
        id=new_id(IdKind.COMMUNITY),
        name="Lake neighbours",
        latitude=lat,
        longitude=lon,
        geohash=geo.encode(float(lat), float(lon)),
        created_at=NOW,
        updated_at=NOW,
        **extra,
    )


def insert(store: Any, record: Any, repo: str = "sessions") -> Any:
    return store.transaction(lambda: getattr(store, repo).insert(record))


class StoreContract:
    def test_insert_get_and_batched_get(self, store: Any) -> None:
        a, b = insert(store, session("alice")), insert(store, session("bob"))
        assert store.sessions.get(a.id) == a
        assert store.sessions.get(new_id(IdKind.SESSION)) is None
        found = store.sessions.get_many([a.id, b.id, a.id, new_id(IdKind.SESSION)])
        assert found == {a.id: a, b.id: b}
        assert store.sessions.get_many([]) == {}

    def test_insert_refuses_an_existing_id(self, store: Any) -> None:
        a = insert(store, session("alice"))
        with pytest.raises(DomainError) as err:
            insert(store, a)
        assert err.value.code is ErrorCode.VERSION_CONFLICT

    def test_replace_is_compare_and_set(self, store: Any) -> None:
        a = insert(store, session("alice"))
        updated = store.sessions.replace(a.model_copy(update={"mode": PlanningMode.AGENT}), 1)
        assert updated.version == 2
        assert store.sessions.get(a.id) == updated and updated.mode is PlanningMode.AGENT
        with pytest.raises(DomainError) as err:
            store.sessions.replace(a, 1)
        assert err.value.code is ErrorCode.VERSION_CONFLICT
        assert err.value.current_version == 2
        with pytest.raises(DomainError) as missing:
            store.sessions.replace(session("alice"), 1)
        assert missing.value.code is ErrorCode.NOT_FOUND

    def test_pages_are_ordered_bounded_and_filter_isolated(self, store: Any) -> None:
        mine = [insert(store, session("alice", minutes=i)) for i in range(7)]
        insert(store, session("bob", minutes=3))
        where = {"owner_uid": "alice"}
        seen: list[str] = []
        after = None
        for _ in range(4):
            page = store.sessions.page(where, page_query(3, after, where))
            seen.extend(s.id for s in page.items)
            assert len(page.items) <= 3
            if not page.has_next_page:
                break
            after = page.end_cursor
        assert seen == [s.id for s in reversed(mine)]
        assert store.sessions.first({"owner_uid": "nobody"}) is None
        assert store.sessions.first(where).id == mine[-1].id

    def test_a_failed_transaction_leaves_nothing_behind(self, store: Any) -> None:
        a = insert(store, session("alice"))

        def fail() -> None:
            store.sessions.insert(session("alice"))
            store.sessions.replace(a.model_copy(update={"status": SessionStatus.CLOSED}), 1)
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "stop")

        with pytest.raises(DomainError):
            store.transaction(fail)
        assert store.sessions.get(a.id) == a
        assert [s.id for s in store.sessions.page({}, page_query(10, None, {})).items] == [a.id]

    def test_a_transaction_reads_its_own_writes(self, store: Any) -> None:
        older = insert(store, session("alice", minutes=0))
        newer = insert(store, session("alice", minutes=1))
        where = {"owner_uid": "alice", "status": SessionStatus.ACTIVE.value}

        seen: dict[str, Any] = {}

        def work() -> None:
            store.sessions.replace(newer.model_copy(update={"status": SessionStatus.CLOSED}), 1)
            seen["after_close"] = store.sessions.first(where)
            seen["added"] = store.sessions.insert(session("alice", minutes=5))
            seen["after_add"] = store.sessions.first(where)
            seen["get"] = store.sessions.get(seen["added"].id)
            seen["page"] = store.sessions.page(where, page_query(10, None, where)).items

        store.transaction(work)
        assert seen["after_close"].id == older.id
        assert seen["after_add"].id == seen["added"].id == seen["get"].id
        assert [s.id for s in seen["page"]] == [seen["added"].id, older.id]

    def test_idempotency_records_round_trip(self, store: Any) -> None:
        record = IdempotencyRecord("alice", "op", "k" * 16, "f" * 64, ("ses_1",), NOW)
        store.transaction(lambda: store.idempotency.put(record))
        got = store.idempotency.get("alice", "op", "k" * 16)
        assert got is not None and got.result_ids == ("ses_1",) and got.fingerprint == "f" * 64
        assert store.idempotency.get("bob", "op", "k" * 16) is None

    def test_geohash_cells_return_only_active_bounded_candidates(self, store: Any) -> None:
        near = insert(store, community("12.9352", "77.6245"), "communities")
        insert(
            store,
            community("12.9353", "77.6246", status=CommunityStatus.ARCHIVED),
            "communities",
        )
        insert(store, community("51.5072", "-0.1276"), "communities")
        insert(
            store,
            Community(id=new_id(IdKind.COMMUNITY), name="No place", created_at=NOW, updated_at=NOW),
            "communities",
        )
        cell = geo.encode(12.9352, 77.6245, 5)
        assert [c.id for c in store.communities.active_in_cells(cell, 10)] == [near.id]
        many = [insert(store, community("12.9352", "77.6245"), "communities") for _ in range(3)]
        assert len(store.communities.active_in_cells(cell, 2)) == 2
        assert len(many) == 3

    def test_lock_owner_only_runs_in_a_transaction(self, store: Any) -> None:
        store.transaction(lambda: store.lock_owner("alice"))
