"""Deterministic AI policy and cost arithmetic (ADR 0015).

These test the pure domain: verified model metadata, exact micro-USD cost (half to even),
reserved vs. settled usage, per-task output caps and the budget conversion. No provider,
no store, no network.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from waterlens.domain.ai import (
    DEFAULT_MODEL_ID,
    GEMINI_2_5_FLASH,
    MODEL_CATALOGUE,
    RESERVATION_RETENTION,
    AiLimits,
    ModelTask,
    ReservationStatus,
    UsageActual,
    UsageEstimate,
    UsageReservation,
    cost_micro_usd,
    model_info,
    reservation_expires_at,
)


def test_verified_model_metadata_is_recorded_exactly() -> None:
    info = MODEL_CATALOGUE[DEFAULT_MODEL_ID]
    assert info.model_id == "gemini-2.5-flash"
    assert info.location == "global"
    assert info.price.input_per_mtok == "0.30"
    assert info.price.output_per_mtok == "2.50"  # output price includes reasoning/thinking
    assert info.price.price_date == "2026-10-12"
    assert info.price.introductory_until is None  # stable, not a time-limited discount
    # the current latest Flash is recorded as an option
    assert "gemini-3.8-flash" in MODEL_CATALOGUE
    assert MODEL_CATALOGUE["gemini-3.8-flash"].price.introductory_until == "2026-12-31"


def test_every_model_cites_an_official_source_and_pricing_mode() -> None:
    # Each configured price must point at the official page it was read from and record its
    # billing mode; nothing claims the project has access to the model.
    for info in MODEL_CATALOGUE.values():
        assert info.price.source_url.startswith("https://cloud.google.com/")
        assert "pay-as-you-go" in info.price.pricing_mode
        assert "no free tier" in info.price.pricing_mode
        assert "UNVERIFIED" in info.price.note  # project access is never claimed verified


def test_cost_is_exact_micro_usd_half_to_even() -> None:
    # $0.30 / 1M tokens: 1000 tokens -> 1000 * 0.30 = 300 micro-USD ($0.0003).
    assert cost_micro_usd(1000, "0.30") == 300
    assert cost_micro_usd(0, "2.50") == 0
    # Half to even at the micro-USD boundary: 1 token at $0.5/1M = 0.5 micro -> 0 (even).
    assert cost_micro_usd(1, "0.5") == 0
    # 3 tokens at $0.5/1M = 1.5 micro -> 2 (even).
    assert cost_micro_usd(3, "0.5") == 2


def test_reserved_estimate_is_worst_case_input_plus_full_output() -> None:
    info = GEMINI_2_5_FLASH
    estimate = UsageEstimate(
        model_id=info.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=2000,
        max_output_tokens=1024,
    )
    # 2000 * 0.30 + 1024 * 2.50 = 600 + 2560 = 3160 micro-USD.
    assert estimate.reserved_micro_usd(info) == 3160
    assert estimate.per_attempt_micro_usd(info) == 3160  # one attempt by default


def test_reservation_covers_every_permitted_dispatched_attempt() -> None:
    # Invariant 1: with retries allowed, the hold is the per-attempt worst case times the
    # number of permitted attempts (initial + retries), since each attempt is billable.
    info = GEMINI_2_5_FLASH
    estimate = UsageEstimate(
        model_id=info.model_id,
        task=ModelTask.OPTION_EXPLANATION,
        input_tokens=2000,
        max_output_tokens=1024,
        max_attempts=3,  # initial attempt + two transient retries
    )
    assert estimate.per_attempt_micro_usd(info) == 3160
    assert estimate.reserved_micro_usd(info) == 3160 * 3
    assert estimate.reserved_tokens() == (2000 + 1024) * 3


def test_settled_cost_counts_output_including_thinking_and_cached_input() -> None:
    info = GEMINI_2_5_FLASH
    actual = UsageActual(
        input_tokens=2000,
        output_tokens=800,  # already includes the 300 thinking tokens below
        thinking_tokens=300,
        cached_input_tokens=500,
    )
    # non-cached input 1500 * 0.30 + cached 500 * 0.03 + output 800 * 2.50
    #   = 450 + 15 + 2000 = 2465 micro-USD (thinking is part of output, not extra).
    assert actual.settled_micro_usd(info) == 2465


def test_each_task_has_an_output_cap_and_requests_are_clamped() -> None:
    limits = AiLimits()
    assert limits.output_limit(ModelTask.GOAL_INTERPRETATION, None) == 512
    assert limits.output_limit(ModelTask.PROPOSAL_NARRATIVE, None) == 2048
    # A request larger than the task cap is clamped down; a smaller one is honoured.
    assert limits.output_limit(ModelTask.GOAL_INTERPRETATION, 5000) == 512
    assert limits.output_limit(ModelTask.OPTION_EXPLANATION, 256) == 256


def test_budget_is_only_configured_when_the_owner_sets_it() -> None:
    assert AiLimits.budget_micro_from_usd(None) is None  # no spend without an owner choice
    assert AiLimits.budget_micro_from_usd("5") == 5_000_000  # $5 -> 5,000,000 micro-USD


def test_default_limits_match_the_proposed_values() -> None:
    limits = AiLimits()
    assert limits.daily_request_limit == 100
    assert limits.max_calls_per_run == 5
    assert limits.transient_retries == 2
    assert limits.max_active_runs_per_session == 1


@pytest.mark.parametrize("tokens", [-1, -1000])
def test_negative_token_counts_are_rejected(tokens: int) -> None:
    with pytest.raises(ValueError):
        cost_micro_usd(tokens, "0.30")


def test_unknown_model_has_no_info() -> None:
    assert model_info("not-a-model") is None


def _reservation(**over: object) -> UsageReservation:
    base: dict[str, object] = {
        "id": "res-1",
        "owner_uid": "owner-1",
        "day": "2026-10-12",
        "model_id": DEFAULT_MODEL_ID,
        "task": ModelTask.OPTION_EXPLANATION,
        "reserved_micro_usd": 1000,
        "reserved_tokens": 100,
        "created_at": datetime(2026, 10, 12, 9, 0, tzinfo=UTC),
        "updated_at": datetime(2026, 10, 12, 9, 0, tzinfo=UTC),
    }
    base.update(over)
    return UsageReservation(**base)  # type: ignore[arg-type]


def test_retention_keeps_unresolved_records_and_ttls_resolved_ones() -> None:
    settled_at = datetime(2026, 10, 12, 9, 5, tzinfo=UTC)
    # Invariant 3: a live hold and an unresolved (estimated) settle are kept with no TTL, so
    # a reconciliation record and its idempotency guard are never deleted prematurely.
    assert reservation_expires_at(_reservation(status=ReservationStatus.RESERVED)) is None
    unresolved = _reservation(
        status=ReservationStatus.SETTLED,
        estimated=True,
        settled_micro_usd=1000,
        settled_at=settled_at,
    )
    assert reservation_expires_at(unresolved) is None
    # A clean settle, a reconciled estimate and a release are resolved → TTL applies.
    clean = _reservation(
        status=ReservationStatus.SETTLED, settled_micro_usd=800, settled_at=settled_at
    )
    assert reservation_expires_at(clean) == settled_at + RESERVATION_RETENTION
    released = _reservation(status=ReservationStatus.RELEASED)
    assert reservation_expires_at(released) == released.updated_at + RESERVATION_RETENTION
