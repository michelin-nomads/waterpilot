"""The ``aiStatus`` query over HTTP and the guarantee that ordinary planning never depends
on AI (ADR 0015). AI is advisory: the client reads this to decide whether to offer AI and,
when it cannot, to explain why. No model is ever called here."""

from __future__ import annotations

from pathlib import Path

from conftest import LOCAL_OK, LoadSettings
from graphql_harness import AREA_ID, Harness, make_harness
from waterpilot.adapters.model_fake import FakeModelProvider
from waterpilot.application.services.common import AiConfig
from waterpilot.domain.ai import AiLimits

TOKEN = "t-alice"

AI_STATUS = """
query {
  aiStatus {
    available reason modelId requestsRemaining dailyRequestLimit
    budgetConfigured suggestedDailyBudgetUsd
  }
}"""

CREATE_SESSION = """
mutation($input: CreatePlanningSessionInput!) {
  createPlanningSession(input: $input) { session { id } error { code } }
}"""


def _funded_limits() -> AiLimits:
    return AiLimits(daily_budget_micro_usd=AiLimits.budget_micro_from_usd("5"))


def _harness(load_settings: LoadSettings, tmp_path: Path, ai: AiConfig | None) -> Harness:
    return make_harness(load_settings(LOCAL_OK), tmp_path, ai=ai)


def _status(h: Harness) -> dict:
    body = h.gql(AI_STATUS, token=TOKEN)
    assert "errors" not in body, body
    return body["data"]["aiStatus"]


def test_disabled_by_default(load_settings: LoadSettings, tmp_path: Path) -> None:
    h = _harness(load_settings, tmp_path, None)  # the default config is fully disabled
    status = _status(h)
    assert status["available"] is False
    assert status["reason"] == "DISABLED"
    assert status["suggestedDailyBudgetUsd"] == "5"


def test_invite_only_reported(load_settings: LoadSettings, tmp_path: Path) -> None:
    ai = AiConfig(
        provider=FakeModelProvider(),
        enabled=True,
        open_to_all=False,
        invited=frozenset({"someone-else"}),
        limits=_funded_limits(),
    )
    status = _status(_harness(load_settings, tmp_path, ai))
    assert status["available"] is False
    assert status["reason"] == "NOT_INVITED"


def test_no_budget_configured_reported(load_settings: LoadSettings, tmp_path: Path) -> None:
    ai = AiConfig(provider=FakeModelProvider(), enabled=True, open_to_all=True)
    status = _status(_harness(load_settings, tmp_path, ai))
    assert status["available"] is False
    assert status["reason"] == "NO_BUDGET_CONFIGURED"
    assert status["budgetConfigured"] is False


def test_available_when_configured(load_settings: LoadSettings, tmp_path: Path) -> None:
    ai = AiConfig(
        provider=FakeModelProvider(),
        enabled=True,
        open_to_all=True,
        model="gemini-2.5-flash",
        limits=_funded_limits(),
    )
    status = _status(_harness(load_settings, tmp_path, ai))
    assert status["available"] is True
    assert status["reason"] is None
    assert status["modelId"] == "gemini-2.5-flash"
    assert status["dailyRequestLimit"] == 100
    assert status["requestsRemaining"] == 100
    assert status["budgetConfigured"] is True


def test_ordinary_planning_works_with_ai_disabled(
    load_settings: LoadSettings, tmp_path: Path
) -> None:
    h = _harness(load_settings, tmp_path, None)  # AI disabled
    body = h.gql(
        CREATE_SESSION,
        {
            "input": {
                "mode": "TRADITIONAL",
                "areaId": AREA_ID,
                "idempotencyKey": "key-session-ai-disabled-0001",
            }
        },
        TOKEN,
    )
    created = body["data"]["createPlanningSession"]
    assert created["error"] is None
    assert created["session"]["id"]  # planning never touched the gateway
