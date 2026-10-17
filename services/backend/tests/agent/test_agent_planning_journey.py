"""End-to-end planning journey integration tests using Group 1 services.

Verifies the short journey:
inspect state -> collect missing input -> calculate -> update workspace ->
explain result -> request confirmation where required.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest

from graphql_harness import AREA_ID
from waterpilot.adapters.catalogue_synthetic import synthetic_area_catalogue
from waterpilot.adapters.jobqueue_memory import MemoryJobQueue
from waterpilot.adapters.places_fixture import FixturePlaceSearch
from waterpilot.adapters.store_memory import MemoryStore
from waterpilot.application.agent import (
    AgentActionKind,
    AgentActionService,
    AgentToolRuntime,
    ConfirmActionInput,
)
from waterpilot.application.agent.conversation import ConversationAgent, ConversationTool
from waterpilot.application.identity import AccountKind, Principal, RequestContext
from waterpilot.application.services import Deps, Services
from waterpilot.application.services.common import AiConfig
from waterpilot.domain.ai import DEFAULT_MODEL_ID, AiLimits
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, new_id
from waterpilot.domain.jobs import AgentRun
from waterpilot.domain.planning import PlanningMode, PlanningSession
from waterpilot.domain.reports import ReportStatus

NOW = datetime(2026, 10, 13, 9, 0, tzinfo=UTC)
OWNER = Principal("owner-journey", AccountKind.PERMANENT, "google.com", NOW)
CTX = RequestContext("r-journey", OWNER)


def _world():
    store = MemoryStore(areas=synthetic_area_catalogue())
    cfg = AiConfig(
        enabled=True,
        open_to_all=True,
        model=DEFAULT_MODEL_ID,
        limits=AiLimits(daily_budget_micro_usd=AiLimits.budget_micro_from_usd("5")),
    )
    services = Services.build(
        Deps(
            store=store,
            clock=lambda: NOW,
            jobs=MemoryJobQueue(),
            places=FixturePlaceSearch(),
            ai=cfg,
            demo_evidence=True,
        )
    )
    session = PlanningSession(
        id=new_id(IdKind.SESSION),
        owner_uid=OWNER.uid,
        area_id=AREA_ID,
        mode=PlanningMode.TRADITIONAL,
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.sessions.insert(session))
    run = AgentRun(
        id=new_id(IdKind.AGENT_RUN),
        owner_uid=OWNER.uid,
        session_id=session.id,
        expires_at=NOW + timedelta(hours=1),
        created_at=NOW,
        updated_at=NOW,
    )
    store.transaction(lambda: store.agent_runs.insert(run))
    runtime = AgentToolRuntime(services, CTX, run.id)
    actions = AgentActionService(services)
    return store, services, session, run, runtime, actions


def test_complete_agent_planning_journey():
    """Verify the full short planning journey against real application services:
    inspect state -> collect missing input -> calculate -> update workspace ->
    explain result -> request confirmation where required.
    """
    store, services, session, run, runtime, actions = _world()

    # 1. Inspect state: inspect current planning session and data availability
    state = runtime.call("inspect_planning_state", {})
    assert state.data["areaId"] == AREA_ID
    assert state.data["version"] == 1
    assert state.data["inputsRevision"] == 0

    coverage = runtime.call("inspect_coverage", {})
    assert "coverage" in coverage.data and "readiness" in coverage.data
    # Honest data reporting: baseline has missing essentials before inputs
    initial_baseline = runtime.call("inspect_baseline", {})
    assert initial_baseline.data["areaId"] == AREA_ID
    assert isinstance(initial_baseline.data["demo"], bool)
    assert "missingEssentials" in initial_baseline.data
    assert len(initial_baseline.data["missingEssentials"]) > 0

    # 2. Collect missing required user inputs (explicitly labeled test inputs)
    inputs_to_record = [
        ("population", "12000", "people"),
        ("per_capita_standard", "135", "L/day"),
        ("delivered_supply", "1.2", "MLD"),
        ("tanker_supply", "0.36", "MLD"),
    ]
    for inp, val, unit in inputs_to_record:
        record = runtime.call(
            "record_manual_input",
            {
                "input": inp,
                "value": val,
                "unit": unit,
                "as_of": date(2026, 10, 1),
                "note": f"[TEST INPUT] Synthetic utility meter reading for {inp}",
            },
        )
        assert record.data["input"] == inp
        assert "value" in record.data and record.data["value"]

    # Verify session inputs_revision incremented and selected plan was reset
    reloaded_session = store.sessions.get(session.id)
    assert reloaded_session.inputs_revision == len(inputs_to_record)
    assert reloaded_session.version > 1

    # 3. Calculate: recalculate baseline with the recorded manual inputs
    updated_baseline = runtime.call("inspect_baseline", {})
    metrics = {m["metric"]: m for m in updated_baseline.data["metrics"]}
    assert "delivered_supply" in metrics
    # Authoritative service results: origin is USER_ESTIMATE for manual metrics
    assert metrics["delivered_supply"]["origin"] == "user_estimate"
    # Normalized to L/day from 1.2 MLD
    assert metrics["delivered_supply"]["value"]["value"] == "1200000"
    assert metrics["delivered_supply"]["unit"] == "L/day"

    # 4. Update workspace: set site profile, set goal, and calculate options
    profile = runtime.call(
        "update_site_profile",
        {"community_type": "residential", "occupied_homes": 450},
    )
    assert profile.data["siteProfile"]["communityType"] == "residential"
    assert profile.data["siteProfile"]["occupiedHomes"] == 450

    goal_payload = {
        "kind": "reduce_tanker_dependence",
        "target": {"mode": "relative_reduction", "quantity": {"value": "0.5", "unit": "ratio"}},
        "site": {"scale": "building", "storage_space": True, "piped_supply": True},
        "estimates": [
            {
                "intervention_id": "efficient_fixtures",
                "effects": [{"key": "demand_reduction", "low": "0.2", "high": "0.25"}],
            },
            {
                "intervention_id": "greywater_reuse",
                "effects": [{"key": "reuse_share", "low": "0.1", "high": "0.1"}],
            },
        ],
    }
    goal = runtime.call("set_goal", {"goal": goal_payload})
    assert goal.data["goal"]["kind"] == "reduce_tanker_dependence"

    # Compare feasible options generated by OptionService
    compared = runtime.call("compare_options", {})
    options = compared.data.get("options", [])
    assert len(options) > 0
    selected_option_id = options[0]["id"]

    # Select the feasible option
    selected = runtime.call("select_option", {"option_id": selected_option_id})
    assert selected.data["selectedPlanOptionId"] == selected_option_id

    # 5. Explain result: explain the chosen option with units and provenance
    explained = runtime.call("explain_option", {"option_id": selected_option_id})
    assert "option" in explained.data
    opt = explained.data["option"]
    assert opt["id"] == selected_option_id
    assert "waterLow" in opt
    assert "cost" in opt
    assert "measures" in opt
    assert "impact" in explained.data

    # 6. Request confirmation where required: prepare report finalization
    prepared = runtime.call(
        "prepare_finalize_report",
        {"title": "Parkway Community Water Resilience Plan"},
    )
    assert prepared.prepared is True
    assert prepared.data["kind"] == AgentActionKind.FINALIZE_REPORT.value
    assert prepared.data["resourceId"] == session.id

    # Protected write: execute confirmation via AgentActionService
    confirm_in = ConfirmActionInput(
        kind=AgentActionKind.FINALIZE_REPORT,
        resource_id=session.id,
        expected_version=prepared.data["expectedVersion"],
        confirmation_token=prepared.data["confirmationToken"],
        parameters=prepared.data["parameters"],
        idempotency_key="confirm-journey-0001",
    )
    finalized = actions.confirm(CTX, confirm_in)
    assert finalized["status"] == ReportStatus.FINALIZED.value
    assert finalized["title"] == "Parkway Community Water Resilience Plan"


def test_failed_tool_calls_emit_failed_status_event():
    """Defect regression: failed tool calls must emit status='failed'
    instead of status='completed'."""
    from waterpilot.adapters.conversation_memory import MemoryConversationStore

    store, services, session, run, runtime, _ = _world()
    conv_store = MemoryConversationStore()
    agent = ConversationAgent(services, conv_store)
    observed_version = [session.version]
    spec = next(s for s in runtime.catalogue() if s.name == "set_area")
    tool = ConversationTool(spec, runtime, agent, CTX, run.id, observed_version)

    # Calling with non-existent area should produce a domain error
    result = asyncio.run(
        tool.run_async(
            args={"area_id": "non_existent_area"},
            tool_context=SimpleNamespace(function_call_id="call-fail-1"),
        )
    )
    assert "error" in result

    # Check the emitted events
    events = agent.get(CTX, run.id).events
    tool_events = [e for e in events if e.get("type") == "tool"]
    assert len(tool_events) == 2  # 'running' then 'failed'
    assert tool_events[-1]["status"] == "failed"
    assert "error" in tool_events[-1]
    # Tool must NOT be described as completed
    assert not any(e.get("type") == "tool" and e.get("status") == "completed" for e in events)


def test_tool_success_invalidates_workspace_state():
    """Verify tool success emits invalidate event with appropriate query keys."""
    from waterpilot.adapters.conversation_memory import MemoryConversationStore

    store, services, session, run, runtime, _ = _world()
    conv_store = MemoryConversationStore()
    agent = ConversationAgent(services, conv_store)
    observed_version = [session.version]
    spec = next(s for s in runtime.catalogue() if s.name == "record_manual_input")
    tool = ConversationTool(spec, runtime, agent, CTX, run.id, observed_version)

    result = asyncio.run(
        tool.run_async(
            args={
                "input": "delivered_supply",
                "value": "75000",
                "unit": "L/day",
                "as_of": date(2026, 10, 1),
                "note": "[TEST INPUT] Invalidation verification",
            },
            tool_context=SimpleNamespace(function_call_id="call-inv-1"),
        )
    )
    assert "result" in result

    events = agent.get(CTX, run.id).events
    inv_events = [e for e in events if e.get("type") == "invalidate"]
    assert len(inv_events) == 1
    keys = inv_events[0]["keys"]
    assert ["session", session.id] in keys
    assert ["session", "current"] in keys
    assert ["readiness"] in keys
    assert ["baseline"] in keys


def test_reserved_identity_keys_are_rejected():
    """Tool arguments cannot set owner, admin, or session identity."""
    _, _, _, _, runtime, _ = _world()
    for hostile_arg in [
        {"owner_uid": "attacker"},
        {"session_id": "other_session"},
        {"run_id": "other_run"},
        {"nested": {"user_id": "attacker"}},
    ]:
        with pytest.raises(DomainError) as exc:
            runtime.call("inspect_planning_state", hostile_arg)
        assert exc.value.code is ErrorCode.FORBIDDEN


def test_agent_edits_the_same_structured_baseline_and_preserves_unknown_supply():
    store, services, session, _, runtime, _ = _world()
    record = {
        "area_id": AREA_ID,
        "concern": "Seasonal shortages",
        "notes": "Owner supplied",
        "residents": 240,
        "daily_use": "32400",
        "demand_estimated": True,
        "demand_source": "80 homes × 3 residents × 135 litres per person",
        "as_of": "2026-10-12",
        "supply_complete": True,
        "sources": [
            {
                "name": "Tanker",
                "kind": "tanker",
                "method": "daily_average",
                "quantity": "25000",
                "source": "Owner delivery records",
            }
        ],
    }
    saved = runtime.call("update_community_baseline", record)
    assert saved.data["communityBaseline"]["dailyUse"] == "32400"
    baseline = services.baseline.baseline(CTX, AREA_ID, session.id)
    assert next(m for m in baseline.metrics if m.metric == "average_supply_gap").value == 7400
    record["supply_complete"] = False
    runtime.call("update_community_baseline", record)
    baseline = services.baseline.baseline(CTX, AREA_ID, session.id)
    assert next(m for m in baseline.metrics if m.metric == "average_supply_gap").value is None
    assert store.sessions.get(session.id).inputs_revision == 2
