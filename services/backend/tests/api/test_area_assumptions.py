"""Small local contract checks; no SDK client, network or model credentials."""

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from conftest import LOCAL_OK, PILOT_OK, LoadSettings
from graphql_harness import NOW, Harness, make_harness
from waterlens.adapters.catalogue_synthetic import SYNTHETIC_AREA_ID
from waterlens.adapters.factory import build_model_provider
from waterlens.adapters.model_agent_fake import LocalAgentProvider
from waterlens.adapters.model_fake import FakeModelProvider, response
from waterlens.application.services.common import AiConfig
from waterlens.config import ConfigError
from waterlens.domain.ai import AiLimits
from waterlens.domain.ids import IdKind, new_id
from waterlens.domain.planning import PlanningMode, PlanningSession

PATH = "/v1/area-assumptions"
HEADERS = {"authorization": "Bearer t-alice"}
ANSWER = {
    "residents_per_home": 4,
    "per_capita_lpd": {"low": "80", "value": "100", "high": "135"},
    "delivered_supply_lpd": {"low": "70000", "value": "80000", "high": "90000"},
    "tanker_supply_lpd": {"low": "10000", "value": "20000", "high": "30000"},
    "rationale": "Synthetic assumptions for a local contract test, not real city data.",
}


def world(
    load_settings: LoadSettings,
    tmp_path: Path,
    *,
    answer: dict[str, Any] | None = None,
    **over: Any,
) -> tuple[Harness, FakeModelProvider, dict[str, Any]]:
    settings = load_settings(LOCAL_OK)
    settings.area_assumptions_enabled = True
    settings.area_assumptions_fake = True
    provider = FakeModelProvider(
        default=response(
            json.dumps(ANSWER if answer is None else answer), input_tokens=100, output_tokens=100
        )
    )
    cfg = AiConfig(
        provider=provider,
        enabled=True,
        open_to_all=True,
        limits=AiLimits(daily_budget_micro_usd=5_000_000),
    )
    h = make_harness(settings, tmp_path, ai=replace(cfg, **over))
    sid = new_id(IdKind.SESSION)
    h.store.transaction(
        lambda: h.store.sessions.insert(
            PlanningSession(
                id=sid,
                owner_uid="alice",
                area_id=SYNTHETIC_AREA_ID,
                mode=PlanningMode.TRADITIONAL,
                created_at=NOW,
                updated_at=NOW,
            )
        )
    )
    body = {
        "session_id": sid,
        "inputs_revision": 0,
        "households": 250,
        "idempotency_key": "illustrative-request-0001",
    }
    return h, provider, body


def test_preview_is_private_durable_idempotent_and_does_not_change_baseline(
    load_settings: LoadSettings,
    tmp_path: Path,
) -> None:
    h, provider, body = world(load_settings, tmp_path)
    before = h.store.sessions.get(body["session_id"])
    first = h.client.post(PATH, json=body, headers=HEADERS)
    assert first.status_code == 200, first.text
    data = first.json()
    preview = data["preview"]
    assert preview["evidence"] == "synthetic" and preview["population"] == 1000
    assert preview["demand_lpd"] == "100000" and preview["average_gap_lpd"] == "20000"
    assert preview["tanker_dependence"] == "0.25"
    assert "Groundwater" in data["notice"] and not data["stale"]
    assert h.store.sessions.get(body["session_id"]) == before
    assert h.store.manual_inputs.first({}) is None and h.store.source_snapshots.first({}) is None
    assert h.client.post(PATH, json=body, headers=HEADERS).json() == data
    read = f"{PATH}/{body['session_id']}/{body['idempotency_key']}"
    assert h.client.get(read, headers=HEADERS).json() == data
    assert h.client.get(read).status_code == 401
    assert h.client.get(read, headers={"authorization": "Bearer t-bob"}).status_code == 404
    assert h.client.post(PATH, json=body).status_code == 401
    assert h.client.post(PATH, json={**body, "households": 251}, headers=HEADERS).status_code == 409
    assert len(provider.calls) == 1
    assert before is not None
    h.store.transaction(
        lambda: h.store.sessions.replace(
            before.model_copy(update={"inputs_revision": 1}), before.version
        )
    )
    assert h.client.get(read, headers=HEADERS).json()["stale"]
    assert (
        h.client.post(
            PATH, json={**body, "idempotency_key": "stale-preview-key-0001"}, headers=HEADERS
        ).status_code
        == 409
    )
    assert len(provider.calls) == 1


@pytest.mark.parametrize(
    "over",
    [
        {"kill_switch": True},
        {"limits": AiLimits()},
        {"open_to_all": False},
    ],
)
def test_preview_keeps_budget_kill_switch_and_tester_controls(
    load_settings: LoadSettings,
    tmp_path: Path,
    over: dict[str, object],
) -> None:
    h, provider, body = world(load_settings, tmp_path, **over)
    assert h.client.post(PATH, json=body, headers=HEADERS).status_code in {403, 503}
    assert provider.calls == []
    # A transport retry cannot implicitly turn a failed request into a paid call.
    assert h.client.post(PATH, json=body, headers=HEADERS).json()["preview"]["status"] == "failed"
    assert provider.calls == []


def test_invalid_model_output_fails_without_applying_or_redispatching(
    load_settings: LoadSettings,
    tmp_path: Path,
) -> None:
    bad = {**ANSWER, "groundwater_level": "invented"}
    h, provider, body = world(load_settings, tmp_path, answer=bad)
    assert h.client.post(PATH, json=body, headers=HEADERS).status_code == 422
    assert h.client.post(PATH, json=body, headers=HEADERS).json()["preview"]["status"] == "failed"
    assert len(provider.calls) == 1
    assert h.store.manual_inputs.first({}) is None


def test_fake_setup_is_explicit_and_rejected_in_pilot(load_settings: LoadSettings) -> None:
    settings = load_settings({**LOCAL_OK, "WL_AREA_ASSUMPTIONS_FAKE": "true"})
    assert isinstance(build_model_provider(settings), LocalAgentProvider)
    with pytest.raises(ConfigError, match="WL_AREA_ASSUMPTIONS_FAKE"):
        load_settings({**PILOT_OK, "WL_AREA_ASSUMPTIONS_FAKE": "true"})


def test_ambiguous_provider_failure_is_charged_conservatively_and_not_replayed(
    load_settings: LoadSettings,
    tmp_path: Path,
) -> None:
    h, provider, body = world(load_settings, tmp_path)
    provider.responses = [RuntimeError("private SDK detail")]
    failed = h.client.post(PATH, json=body, headers=HEADERS)
    assert failed.status_code == 503 and "private SDK detail" not in failed.text
    hold = h.store.usage_reservations.first({})
    assert hold is not None and hold.status.value == "settled" and hold.estimated
    assert hold.settled_micro_usd == hold.reserved_micro_usd
    assert h.client.post(PATH, json=body, headers=HEADERS).json()["preview"]["status"] == "failed"
    assert len(provider.calls) == 1
