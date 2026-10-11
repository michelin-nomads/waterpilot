"""Guest-to-account claims over GraphQL with the fake verifier (ADR 0004).

The same flows run against real Auth-emulator tokens in ``tests/emulator``; these cover
the rules that need a controllable clock or many identities."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, LoadSettings
from flows import (
    CURRENT_SESSION,
    FUNDING_MATCHES,
    MATCH_FUNDING,
    begin_claim,
    cancel_claim,
    complete_claim,
    create_session,
    finalize,
    make_ready,
    payload,
    report_ids,
)
from graphql_harness import NOW, FakeVerifier, Harness, make_harness, seed_plan_option
from waterlens.application.identity import Principal
from waterlens.config import ConfigError
from waterlens.domain.accounts import CLAIM_TTL, FRESH_SIGN_IN, ClaimPolicy
from waterlens.domain.planning import SessionStatus


class Clock:
    def __init__(self) -> None:
        self.now = NOW

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


class ClockVerifier(FakeVerifier):
    """Adds ``t-alice-at-clock``: alice, signed in at the clock's current time."""

    def __init__(self, clock: Clock) -> None:
        self._clock = clock

    def verify(self, token: str) -> Principal:
        if token == "t-alice-at-clock":
            alice = super().verify("t-alice")
            return Principal(alice.uid, alice.kind, alice.provider, self._clock())
        return super().verify(token)


@pytest.fixture
def h(load_settings: LoadSettings, tmp_path: Path, clock: Clock) -> Harness:
    settings = load_settings(LOCAL_OK)
    return make_harness(settings, tmp_path, clock=clock, verifier=ClockVerifier(clock))


def gql(h: Harness):  # type: ignore[no-untyped-def]
    return lambda q, v, t: h.gql(q, v, t)


def key(n: int) -> str:
    return f"claim-key-{n:010d}"


def guest_with_session(h: Harness, token: str = "t-guest") -> dict[str, Any]:
    return create_session(gql(h), token, key(1))


def started(h: Harness) -> dict[str, Any]:
    out = begin_claim(gql(h), "t-guest")
    assert out["error"] is None, out
    return out


# --- begin ------------------------------------------------------------------------


def test_begin_returns_a_secret_once_and_stores_only_its_hash(h: Harness) -> None:
    out = started(h)
    assert out["claim"]["status"] == "OPEN"
    assert out["claimSecret"] and len(out["claimSecret"]) >= 40
    stored = h.store.account_claims.get(out["claim"]["id"])
    assert stored is not None
    assert out["claimSecret"] not in stored.model_dump_json()
    assert stored.guest_uid == "guest-1"


def test_only_guests_can_begin_a_claim(h: Harness) -> None:
    assert begin_claim(gql(h), "t-alice")["error"]["code"] == "PRECONDITION_FAILED"
    assert begin_claim(gql(h), None)["error"]["code"] == "UNAUTHENTICATED"  # type: ignore[arg-type]


def test_a_new_claim_cancels_the_previous_open_one(h: Harness) -> None:
    first, second = started(h), started(h)
    old = complete_claim(gql(h), "t-alice", first["claim"]["id"], first["claimSecret"], key(2))
    assert old["error"]["code"] == "PRECONDITION_FAILED"
    new = complete_claim(gql(h), "t-alice", second["claim"]["id"], second["claimSecret"], key(3))
    assert new["error"] is None


# --- complete: ownership transfer scope ----------------------------------------------


def test_complete_moves_only_the_guest_active_session_and_its_matches(h: Harness) -> None:
    g = gql(h)
    closed_guest = create_session(g, "t-guest", key(10))
    active_guest = create_session(g, "t-guest", key(11))  # closes the first one
    option = seed_plan_option(h.store, active_guest["id"], cost_high_paise=50_000_000)
    matched = payload(
        g(
            MATCH_FUNDING,
            {
                "input": {
                    "sessionId": active_guest["id"],
                    "planOptionId": option,
                    "idempotencyKey": key(12),
                }
            },
            "t-guest",
        ),
        "matchFunding",
    )
    assert matched["error"] is None and matched["matches"]
    other_guest = create_session(g, "t-guest2", key(13))
    alice_old = create_session(g, "t-alice", key(14))

    claim = started(h)
    done = complete_claim(g, "t-alice", claim["claim"]["id"], claim["claimSecret"], key(15))
    assert done["error"] is None, done
    assert done["claim"]["status"] == "COMPLETED"
    assert done["claim"]["transferredSessionId"] == active_guest["id"]
    assert done["claim"]["closedSessionId"] == alice_old["id"]

    store = h.store
    assert store.sessions.get(active_guest["id"]).owner_uid == "alice"  # type: ignore[union-attr]
    assert store.sessions.get(closed_guest["id"]).owner_uid == "guest-1"  # type: ignore[union-attr]
    assert store.sessions.get(other_guest["id"]).owner_uid == "guest-2"  # type: ignore[union-attr]
    old = store.sessions.get(alice_old["id"])
    assert old is not None and old.status is SessionStatus.CLOSED and old.owner_uid == "alice"
    moved = [store.funding_matches.get(m["id"]) for m in matched["matches"]]
    assert all(m is not None and m.owner_uid == "alice" for m in moved)

    current = payload(g(CURRENT_SESSION, None, "t-alice"), "currentPlanningSession")
    assert current["id"] == active_guest["id"]
    assert payload(g(CURRENT_SESSION, None, "t-guest"), "currentPlanningSession") is None
    visible = payload(g(FUNDING_MATCHES, {"id": active_guest["id"]}, "t-alice"), "fundingMatches")[
        "nodes"
    ]
    assert len(visible) == len(matched["matches"])


def test_complete_without_a_guest_session_moves_nothing(h: Harness) -> None:
    alice = create_session(gql(h), "t-alice", key(20))
    claim = started(h)
    done = complete_claim(gql(h), "t-alice", claim["claim"]["id"], claim["claimSecret"], key(21))
    assert done["error"] is None
    assert done["claim"]["transferredSessionId"] is None
    assert done["claim"]["closedSessionId"] is None
    assert h.store.sessions.get(alice["id"]).status is SessionStatus.ACTIVE  # type: ignore[union-attr]


# --- complete: proof of control, one use, expiry --------------------------------------


def test_wrong_secret_or_unknown_claim_is_not_found(h: Harness) -> None:
    guest_with_session(h)
    claim = started(h)
    wrong = complete_claim(gql(h), "t-alice", claim["claim"]["id"], "x" * 43, key(30))
    assert wrong["error"]["code"] == "NOT_FOUND"
    unknown = complete_claim(
        gql(h), "t-alice", "clm_00000000000000000000000000", claim["claimSecret"], key(31)
    )
    assert unknown["error"]["code"] == "NOT_FOUND"
    malformed = complete_claim(gql(h), "t-alice", "guest-1", claim["claimSecret"], key(32))
    assert malformed["error"]["code"] == "VALIDATION_FAILED"


def test_completing_needs_a_permanent_account(h: Harness) -> None:
    claim = started(h)
    for token in ("t-guest", "t-guest2"):
        out = complete_claim(gql(h), token, claim["claim"]["id"], claim["claimSecret"], key(40))
        assert out["error"]["code"] == "PERMANENT_ACCOUNT_REQUIRED"


def test_completing_needs_a_fresh_sign_in(h: Harness) -> None:
    session = guest_with_session(h)
    claim = started(h)
    stale = complete_claim(
        gql(h), "t-alice-stale", claim["claim"]["id"], claim["claimSecret"], key(50)
    )
    assert stale["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    assert h.store.sessions.get(session["id"]).owner_uid == "guest-1"  # type: ignore[union-attr]
    fresh = complete_claim(gql(h), "t-alice", claim["claim"]["id"], claim["claimSecret"], key(51))
    assert fresh["error"] is None


def test_a_claim_is_one_use_but_a_retry_with_the_same_key_is_replayed(h: Harness) -> None:
    guest_with_session(h)
    claim = started(h)
    args = (claim["claim"]["id"], claim["claimSecret"])
    first = complete_claim(gql(h), "t-alice", *args, key(60))
    retry = complete_claim(gql(h), "t-alice", *args, key(60))
    assert first["error"] is None and retry["error"] is None
    assert retry["claim"] == first["claim"]
    again = complete_claim(gql(h), "t-alice", *args, key(61))
    assert again["error"]["code"] == "PRECONDITION_FAILED"
    stolen = complete_claim(gql(h), "t-bob", *args, key(60))
    assert stolen["error"]["code"] == "PRECONDITION_FAILED"


def test_an_expired_claim_cannot_be_completed(h: Harness, clock: Clock) -> None:
    session = guest_with_session(h)
    claim = started(h)
    clock.now = NOW + CLAIM_TTL
    out = complete_claim(gql(h), "t-alice", claim["claim"]["id"], claim["claimSecret"], key(70))
    assert out["error"]["code"] == "PRECONDITION_FAILED"
    assert "expired" in out["error"]["message"]
    assert h.store.sessions.get(session["id"]).owner_uid == "guest-1"  # type: ignore[union-attr]


def test_the_same_account_cannot_claim_itself(h: Harness) -> None:
    claim = started(h)
    h.store.account_claims.replace(
        h.store.account_claims.get(claim["claim"]["id"]).model_copy(  # type: ignore[union-attr]
            update={"guest_uid": "alice"}
        ),
        1,
    )
    out = complete_claim(gql(h), "t-alice", claim["claim"]["id"], claim["claimSecret"], key(80))
    assert out["error"]["code"] == "PRECONDITION_FAILED"


# --- cancel ------------------------------------------------------------------------


def test_the_guest_can_cancel_and_the_claim_is_then_unusable(h: Harness) -> None:
    session = guest_with_session(h)
    claim = started(h)
    cid = claim["claim"]["id"]
    assert cancel_claim(gql(h), "t-guest2", cid, 1)["error"]["code"] == "NOT_FOUND"
    assert cancel_claim(gql(h), "t-alice", cid, 1)["error"]["code"] == "PRECONDITION_FAILED"
    assert cancel_claim(gql(h), "t-guest", cid, 9)["error"]["code"] == "VERSION_CONFLICT"
    cancelled = cancel_claim(gql(h), "t-guest", cid, 1)
    assert cancelled["error"] is None and cancelled["claim"]["status"] == "CANCELLED"
    out = complete_claim(gql(h), "t-alice", cid, claim["claimSecret"], key(90))
    assert out["error"]["code"] == "PRECONDITION_FAILED"
    assert h.store.sessions.get(session["id"]).owner_uid == "guest-1"  # type: ignore[union-attr]


# --- finalizing after conversion ------------------------------------------------------


def test_guest_cannot_finalize_then_finalizes_once_after_claim(h: Harness) -> None:
    g = gql(h)
    session = guest_with_session(h)
    make_ready(g, "t-guest", session, lambda sid: seed_plan_option(h.store, sid, 50_000_000))
    report_key = key(100)
    denied = finalize(g, "t-guest", session["id"], report_key)
    assert denied["error"]["code"] == "PERMANENT_ACCOUNT_REQUIRED"

    claim = started(h)
    assert (
        complete_claim(g, "t-alice", claim["claim"]["id"], claim["claimSecret"], key(101))["error"]
        is None
    )
    first = finalize(g, "t-alice", session["id"], report_key)
    retry = finalize(g, "t-alice", session["id"], report_key)
    assert first["error"] is None and retry["report"]["id"] == first["report"]["id"]
    assert report_ids(g, "t-alice") == [first["report"]["id"]]


def test_an_open_claim_completes_until_the_last_second(h: Harness, clock: Clock) -> None:
    session = guest_with_session(h)
    claim = started(h)
    clock.now = NOW + CLAIM_TTL - timedelta(seconds=1)
    args = (claim["claim"]["id"], claim["claimSecret"])
    out = complete_claim(gql(h), "t-alice-at-clock", *args, key(110))
    assert out["error"] is None, out
    assert h.store.sessions.get(session["id"]).owner_uid == "alice"  # type: ignore[union-attr]


# --- server-side policy ---------------------------------------------------------------


def test_defaults_are_ten_minute_claims_and_five_minute_fresh_sign_in(
    load_settings: LoadSettings,
) -> None:
    assert (timedelta(minutes=10), timedelta(minutes=5)) == (CLAIM_TTL, FRESH_SIGN_IN)
    assert load_settings(LOCAL_OK).claim_policy == ClaimPolicy()


def test_the_windows_are_configurable_server_side(load_settings: LoadSettings) -> None:
    settings = load_settings(
        {
            **LOCAL_OK,
            "WL_ACCOUNT_CLAIM_TTL_SECONDS": "120",
            "WL_ACCOUNT_CLAIM_FRESH_SIGN_IN_SECONDS": "60",
        }
    )
    assert settings.claim_policy == ClaimPolicy(
        ttl=timedelta(minutes=2), fresh_sign_in=timedelta(minutes=1)
    )


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("WL_ACCOUNT_CLAIM_TTL_SECONDS", "30"),
        ("WL_ACCOUNT_CLAIM_TTL_SECONDS", "7200"),
        ("WL_ACCOUNT_CLAIM_FRESH_SIGN_IN_SECONDS", "10"),
        ("WL_ACCOUNT_CLAIM_FRESH_SIGN_IN_SECONDS", "3600"),
    ],
)
def test_out_of_bounds_windows_fail_closed(
    load_settings: LoadSettings, name: str, value: str
) -> None:
    with pytest.raises(ConfigError, match="WL_ACCOUNT_CLAIM_"):
        load_settings({**LOCAL_OK, name: value})


def test_a_configured_policy_is_enforced(
    load_settings: LoadSettings, tmp_path: Path, clock: Clock
) -> None:
    policy = ClaimPolicy(ttl=timedelta(minutes=2), fresh_sign_in=timedelta(minutes=1))
    h = make_harness(
        load_settings(LOCAL_OK),
        tmp_path,
        clock=clock,
        verifier=ClockVerifier(clock),
        claim_policy=policy,
    )
    session = guest_with_session(h)
    claim = started(h)
    assert datetime.fromisoformat(claim["claim"]["expiresAt"]) == NOW + timedelta(minutes=2)

    # alice signed in at NOW; 90 s later is fresh by default (5 min) but not under this policy.
    clock.now = NOW + timedelta(seconds=90)
    args = (claim["claim"]["id"], claim["claimSecret"])
    stale = complete_claim(gql(h), "t-alice", *args, key(120))
    assert stale["error"]["code"] == "REAUTHENTICATION_REQUIRED"

    # After the configured two minutes the claim has expired, even for a fresh sign-in.
    clock.now = NOW + timedelta(minutes=2)
    expired = complete_claim(gql(h), "t-alice-at-clock", *args, key(121))
    assert expired["error"]["code"] == "PRECONDITION_FAILED"
    assert "expired" in expired["error"]["message"]
    assert h.store.sessions.get(session["id"]).owner_uid == "guest-1"  # type: ignore[union-attr]
