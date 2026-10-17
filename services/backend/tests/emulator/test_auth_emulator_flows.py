"""Guest conversion and token verification against the real Firebase Auth emulator.

Every token here is issued by the emulator exactly as the Web SDK would receive it, and
the API verifies it with the local-mode verifier (claims + emulator account lookup)."""
# ruff: noqa: F811  (pytest injects the fixtures imported from emulator_client by name)

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from emulator_client import (  # noqa: F401 - fixtures are injected by name
    Api,
    AuthEmulator,
    Clock,
    EmulatorError,
    User,
    api,
    clock,
    emu,
    emulator_host,
)

from flows import (
    CURRENT_SESSION,
    VIEWER,
    begin_claim,
    cancel_claim,
    complete_claim,
    create_session,
    finalize,
    make_ready,
    payload,
    report_ids,
)
from graphql_harness import seed_plan_option
from waterpilot.domain.planning import SessionStatus

pytestmark = pytest.mark.emulator

PASSWORD = "correct-horse-battery-1"
_n = iter(range(10**6))


def key() -> str:
    return f"emulator-key-{next(_n):08d}"


def gq(api: Api):  # type: ignore[no-untyped-def]
    return lambda q, v, t: api.gql(q, v, t)


def viewer(api: Api, user: User | str) -> dict[str, Any] | None:
    token = user if isinstance(user, str) else user.id_token
    result: dict[str, Any] | None = api.gql(VIEWER, None, token)["data"]["viewer"]
    return result


def ready_guest(api: Api, emu: AuthEmulator) -> tuple[User, dict[str, Any]]:
    guest = emu.sign_up_guest()
    session = create_session(gq(api), guest.id_token, key())
    seed = lambda sid: seed_plan_option(api.store, sid, 50_000_000)  # noqa: E731
    return guest, make_ready(gq(api), guest.id_token, session, seed)


def owner(api: Api, session_id: str) -> str:
    session = api.store.sessions.get(session_id)
    assert session is not None
    return session.owner_uid


# --- new-account conversion: linking keeps the uid ------------------------------------


def test_linking_a_new_email_account_keeps_the_guest_uid_and_session(
    api: Api, emu: AuthEmulator
) -> None:
    guest, session = ready_guest(api, emu)
    assert viewer(api, guest) == {"uid": guest.uid, "kind": "GUEST"}
    assert finalize(gq(api), guest.id_token, session["id"], key())["error"]["code"] == (
        "PERMANENT_ACCOUNT_REQUIRED"
    )

    linked = emu.link_email(guest, "new-user@example.com", PASSWORD)

    assert linked.uid == guest.uid
    assert viewer(api, linked) == {"uid": guest.uid, "kind": "PERMANENT"}
    current = payload(api.gql(CURRENT_SESSION, None, linked.id_token), "currentPlanningSession")
    assert current["id"] == session["id"]
    report = finalize(gq(api), linked.id_token, session["id"], key())
    assert report["error"] is None
    assert not api.all("account_claims")  # no claim involved


def test_linking_a_new_google_account_keeps_the_guest_uid(api: Api, emu: AuthEmulator) -> None:
    guest, session = ready_guest(api, emu)
    linked = emu.link_google(guest, "google-new-1", "google-new@example.com")
    assert linked.uid == guest.uid
    assert viewer(api, linked) == {"uid": guest.uid, "kind": "PERMANENT"}
    assert finalize(gq(api), linked.id_token, session["id"], key())["error"] is None


def test_the_pre_link_guest_token_stays_a_guest_token(api: Api, emu: AuthEmulator) -> None:
    guest, session = ready_guest(api, emu)
    emu.link_email(guest, "linked@example.com", PASSWORD)
    out = finalize(gq(api), guest.id_token, session["id"], key())
    # Linking a password moves validSince to the current second, so the old token is
    # either still a guest token or already revoked; it never gains permanent rights.
    assert out["error"]["code"] in {"PERMANENT_ACCOUNT_REQUIRED", "UNAUTHENTICATED"}


# --- existing-account conversion: credential already in use -> claim ------------------


def test_existing_email_account_receives_only_the_guest_active_session(
    api: Api, emu: AuthEmulator
) -> None:
    existing = emu.sign_up_email("existing@example.com", PASSWORD)
    account_session = create_session(gq(api), existing.id_token, key())
    guest = emu.sign_up_guest()
    old_guest_session = create_session(gq(api), guest.id_token, key())
    session = create_session(gq(api), guest.id_token, key())  # closes the old one
    make_ready(
        gq(api), guest.id_token, session, lambda sid: seed_plan_option(api.store, sid, 50_000_000)
    )

    with pytest.raises(EmulatorError) as conflict:
        emu.link_email(guest, "existing@example.com", "a-different-password")
    assert conflict.value.code == "EMAIL_EXISTS"

    started = begin_claim(gq(api), guest.id_token)
    assert started["error"] is None
    account = emu.sign_in_email("existing@example.com", PASSWORD)
    done = complete_claim(
        gq(api), account.id_token, started["claim"]["id"], started["claimSecret"], key()
    )

    assert done["error"] is None, done
    assert done["claim"]["transferredSessionId"] == session["id"]
    assert done["claim"]["closedSessionId"] == account_session["id"]
    assert owner(api, session["id"]) == existing.uid
    assert owner(api, old_guest_session["id"]) == guest.uid
    previous = api.store.sessions.get(account_session["id"])
    assert previous is not None and previous.status is SessionStatus.CLOSED
    assert payload(api.gql(CURRENT_SESSION, None, guest.id_token), "currentPlanningSession") is None
    report = finalize(gq(api), account.id_token, session["id"], key())
    assert report["error"] is None
    assert report_ids(gq(api), account.id_token) == [report["report"]["id"]]


def test_existing_google_account_conversion(api: Api, emu: AuthEmulator) -> None:
    google = emu.sign_in_google("google-existing-1", "g-existing@example.com")
    guest, session = ready_guest(api, emu)

    with pytest.raises(EmulatorError) as conflict:
        emu.link_google(guest, "google-existing-1", "g-existing@example.com")
    assert conflict.value.code == "FEDERATED_USER_ID_ALREADY_LINKED"

    started = begin_claim(gq(api), guest.id_token)
    account = emu.sign_in_google("google-existing-1", "g-existing@example.com")
    assert account.uid == google.uid
    done = complete_claim(
        gq(api), account.id_token, started["claim"]["id"], started["claimSecret"], key()
    )
    assert done["error"] is None
    assert owner(api, session["id"]) == google.uid


# --- ownership transfer scope ---------------------------------------------------------


def test_a_claim_moves_one_guest_only_and_cannot_be_reused(api: Api, emu: AuthEmulator) -> None:
    guest_a, session_a = ready_guest(api, emu)
    guest_b, session_b = ready_guest(api, emu)
    alice = emu.sign_up_email("alice@example.com", PASSWORD)
    mallory = emu.sign_up_email("mallory@example.com", PASSWORD)
    started = begin_claim(gq(api), guest_a.id_token)
    claim_id, secret = started["claim"]["id"], started["claimSecret"]

    guessed = complete_claim(gq(api), mallory.id_token, claim_id, "guessed-secret-value", key())
    assert guessed["error"]["code"] == "NOT_FOUND"
    as_guest = complete_claim(gq(api), guest_b.id_token, claim_id, secret, key())
    assert as_guest["error"]["code"] == "PERMANENT_ACCOUNT_REQUIRED"

    assert complete_claim(gq(api), alice.id_token, claim_id, secret, key())["error"] is None
    assert owner(api, session_a["id"]) == alice.uid
    assert owner(api, session_b["id"]) == guest_b.uid

    reused = complete_claim(gq(api), mallory.id_token, claim_id, secret, key())
    assert reused["error"]["code"] == "PRECONDITION_FAILED"
    assert owner(api, session_a["id"]) == alice.uid


def test_completing_after_a_stale_sign_in_requires_signing_in_again(
    api: Api, emu: AuthEmulator, clock: Clock
) -> None:
    guest, session = ready_guest(api, emu)
    account = emu.sign_up_email("stale@example.com", PASSWORD)
    started = begin_claim(gq(api), guest.id_token)
    claim_id, secret = started["claim"]["id"], started["claimSecret"]

    clock.offset = timedelta(minutes=6)  # token still valid, sign-in no longer fresh
    stale = complete_claim(gq(api), account.id_token, claim_id, secret, key())
    assert stale["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    assert owner(api, session["id"]) == guest.uid

    clock.offset = timedelta()
    fresh = emu.sign_in_email("stale@example.com", PASSWORD)
    assert complete_claim(gq(api), fresh.id_token, claim_id, secret, key())["error"] is None


# --- cancellation ---------------------------------------------------------------------


def test_an_abandoned_sign_in_changes_nothing(api: Api, emu: AuthEmulator) -> None:
    """A cancelled popup never reaches Firebase or the API; the guest is untouched and
    can convert later."""
    guest, session = ready_guest(api, emu)
    assert viewer(api, guest) == {"uid": guest.uid, "kind": "GUEST"}
    current = payload(api.gql(CURRENT_SESSION, None, guest.id_token), "currentPlanningSession")
    assert current["id"] == session["id"]
    assert not api.all("account_claims")
    assert emu.link_email(guest, "later@example.com", PASSWORD).uid == guest.uid


def test_a_cancelled_claim_cannot_complete_and_the_guest_keeps_its_work(
    api: Api, emu: AuthEmulator
) -> None:
    guest, session = ready_guest(api, emu)
    account = emu.sign_up_email("cancel@example.com", PASSWORD)
    started = begin_claim(gq(api), guest.id_token)
    cancelled = cancel_claim(gq(api), guest.id_token, started["claim"]["id"], 1)
    assert cancelled["claim"]["status"] == "CANCELLED"

    out = complete_claim(
        gq(api), account.id_token, started["claim"]["id"], started["claimSecret"], key()
    )
    assert out["error"]["code"] == "PRECONDITION_FAILED"
    assert owner(api, session["id"]) == guest.uid

    again = begin_claim(gq(api), guest.id_token)
    retry = complete_claim(
        gq(api), account.id_token, again["claim"]["id"], again["claimSecret"], key()
    )
    assert retry["error"] is None
    assert owner(api, session["id"]) == account.uid


# --- token rejection ------------------------------------------------------------------


def _with_claims(token: str, **changes: Any) -> str:
    header, body, sig = token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    claims.update(changes)
    encoded = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"{header}.{encoded}.{sig}"


@pytest.mark.parametrize(
    "case", ["expired", "wrong-project", "garbage", "deleted", "disabled", "revoked"]
)
def test_rejected_tokens_are_unauthenticated(
    api: Api, emu: AuthEmulator, clock: Clock, case: str
) -> None:
    user = emu.sign_up_email(f"{case}@example.com", PASSWORD)
    assert viewer(api, user) is not None
    token = user.id_token
    if case == "expired":
        clock.offset = timedelta(hours=2)
    elif case == "wrong-project":
        token = _with_claims(
            token, aud="demo-other", iss="https://securetoken.google.com/demo-other"
        )
    elif case == "garbage":
        token = "not.a.token"
    elif case == "deleted":
        emu.delete(user.uid)
    elif case == "disabled":
        emu.disable(user.uid)
    elif case == "revoked":
        emu.revoke(user.uid, datetime.now(UTC) + timedelta(seconds=2))

    assert viewer(api, token) is None
    out = payload(
        api.gql(
            "mutation($i: CreatePlanningSessionInput!) { createPlanningSession(input: $i) "
            "{ error { code } } }",
            {"i": {"mode": "TRADITIONAL", "idempotencyKey": key()}},
            token,
        ),
        "createPlanningSession",
    )
    assert out["error"]["code"] == "UNAUTHENTICATED"


def test_a_refreshed_token_is_accepted_after_expiry(
    api: Api, emu: AuthEmulator, clock: Clock
) -> None:
    user = emu.sign_up_email("refresh@example.com", PASSWORD)
    clock.offset = timedelta(hours=2)
    assert viewer(api, user) is None
    clock.offset = timedelta()
    assert viewer(api, emu.refresh(user)) == {"uid": user.uid, "kind": "PERMANENT"}


PERMANENT_ONLY = [
    (
        "finalizeReport",
        "FinalizeReportInput",
        {"sessionId": "ses_00000000000000000000000000", "title": "t", "idempotencyKey": "k" * 16},
    ),
    (
        "generateProposal",
        "GenerateProposalInput",
        {
            "reportId": "rep_00000000000000000000000000",
            "sections": ["PLAN"],
            "idempotencyKey": "k" * 16,
        },
    ),
    ("createCommunity", "CreateCommunityInput", {"name": "Ward 5", "idempotencyKey": "k" * 16}),
    (
        "joinCommunity",
        "JoinCommunityInput",
        {"communityId": "com_00000000000000000000000000", "idempotencyKey": "k" * 16},
    ),
    (
        "leaveCommunity",
        "LeaveCommunityInput",
        {"communityId": "com_00000000000000000000000000", "expectedVersion": 1},
    ),
    (
        "startImplementationProject",
        "StartImplementationProjectInput",
        {
            "reportId": "rep_00000000000000000000000000",
            "title": "Build",
            "idempotencyKey": "k" * 16,
        },
    ),
]


@pytest.mark.parametrize(("mutation", "input_type", "variables"), PERMANENT_ONLY)
def test_guests_cannot_finalize_propose_or_act_on_communities_and_tracking(
    api: Api, emu: AuthEmulator, mutation: str, input_type: str, variables: dict[str, Any]
) -> None:
    guest = emu.sign_up_guest()
    query = f"mutation($i: {input_type}!) {{ {mutation}(input: $i) {{ error {{ code }} }} }}"
    out = payload(api.gql(query, {"i": variables}, guest.id_token), mutation)
    assert out["error"]["code"] == "PERMANENT_ACCOUNT_REQUIRED"


# --- retry without duplicate reports --------------------------------------------------


def test_retries_after_expiry_and_a_lost_response_create_one_report(
    api: Api, emu: AuthEmulator, clock: Clock
) -> None:
    guest, session = ready_guest(api, emu)
    account = emu.link_email(guest, "retry@example.com", PASSWORD)
    report_key = key()

    clock.offset = timedelta(hours=2)  # the token expired while the user was reviewing
    expired = finalize(gq(api), account.id_token, session["id"], report_key)
    assert expired["error"]["code"] == "UNAUTHENTICATED"
    assert not api.all("reports")

    clock.offset = timedelta()
    refreshed = emu.refresh(account)
    first = finalize(gq(api), refreshed.id_token, session["id"], report_key)
    lost_response_retry = finalize(gq(api), refreshed.id_token, session["id"], report_key)
    assert first["error"] is None
    assert lost_response_retry["report"]["id"] == first["report"]["id"]
    assert report_ids(gq(api), refreshed.id_token) == [first["report"]["id"]]
    assert len(api.all("reports")) == 1


def test_finalize_rejected_as_guest_then_retried_after_linking_creates_one_report(
    api: Api, emu: AuthEmulator
) -> None:
    guest, session = ready_guest(api, emu)
    report_key = key()
    denied = finalize(gq(api), guest.id_token, session["id"], report_key)
    assert denied["error"]["code"] == "PERMANENT_ACCOUNT_REQUIRED"
    account = emu.link_email(guest, "after-link@example.com", PASSWORD)
    first = finalize(gq(api), account.id_token, session["id"], report_key)
    second = finalize(gq(api), account.id_token, session["id"], report_key)
    assert first["report"]["id"] == second["report"]["id"]
    assert len(api.all("reports")) == 1


def test_retry_after_claim_creates_one_report(api: Api, emu: AuthEmulator) -> None:
    existing = emu.sign_up_email("claim-retry@example.com", PASSWORD)
    guest, session = ready_guest(api, emu)
    started = begin_claim(gq(api), guest.id_token)
    account = emu.sign_in_email("claim-retry@example.com", PASSWORD)
    claim_key = key()
    args = (started["claim"]["id"], started["claimSecret"])
    first_claim = complete_claim(gq(api), account.id_token, *args, claim_key)
    replayed_claim = complete_claim(gq(api), account.id_token, *args, claim_key)
    assert replayed_claim["claim"] == first_claim["claim"]

    report_key = key()
    reports = {
        finalize(gq(api), account.id_token, session["id"], report_key)["report"]["id"]
        for _ in range(3)
    }
    assert len(reports) == 1
    assert report_ids(gq(api), existing.id_token) == list(reports)
