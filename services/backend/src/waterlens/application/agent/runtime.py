"""The agent tool runtime and the confirmation service (ADR 0017).

:class:`AgentToolRuntime` is the only way the agent reaches a tool. For every call it:

- rejects any identity-bearing argument (owner/admin/project/session/run ids) outright, so a
  model-supplied, document-supplied or user-supplied argument can never change who the tool
  acts as or which session it touches;
- authorizes against the run's **current** record (owner, RUNNING, not expired) and claims a
  monotonic step on the run, so a replayed/old step is refused independently of any TTL
  cleanup, and the tool count and loops are bounded;
- validates the arguments into the tool's typed model (extra fields rejected) and runs the
  handler, which calls the same authorized application service the GraphQL API uses.

:class:`AgentActionService` executes a :class:`PreparedAction` only when the product UI
confirms it. It re-derives the confirmation token from the resource's **current** version,
so a stale confirmation (the resource changed since it was prepared) is refused before any
service is called, and then routes through the same authorized service.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from waterlens.application.agent.actions import (
    CAS_ACTIONS,
    AgentActionKind,
    ConfirmActionInput,
    confirmation_token,
)
from waterlens.application.agent.context import RunContext
from waterlens.application.agent.registry import TOOLS_BY_NAME, ToolKind, ToolSpec
from waterlens.application.identity import RequestContext
from waterlens.application.policies import readable_project
from waterlens.application.services import Services
from waterlens.application.services.common import build
from waterlens.domain.ai import AiLimits
from waterlens.domain.errors import DomainError, ErrorCode, not_found
from waterlens.domain.ids import IdKind, require_id
from waterlens.domain.jobs import AgentRun, AgentRunStatus, AgentStopReason
from waterlens.domain.tracking import MilestoneStatus

type Json = dict[str, Any]

# Argument keys that could name an owner, administrator, project owner, session or run. A
# tool argument is *data*, never identity: these are refused wherever they appear (including
# nested objects), so a forged id in a model argument, a retrieved document or user text can
# never redefine who the tool acts as or which run/session it touches.
RESERVED_IDENTITY_KEYS: frozenset[str] = frozenset(
    {
        "uid",
        "owner",
        "owner_uid",
        "owneruid",
        "ownerid",
        "owner_id",
        "user",
        "user_id",
        "userid",
        "principal",
        "actor",
        "admin",
        "is_admin",
        "role",
        "roles",
        "sub",
        "subject",
        "impersonate",
        "on_behalf_of",
        "run_id",
        "runid",
        "session_id",
        "sessionid",
    }
)


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _camel_key(key: str) -> str:
    head, *rest = key.split("_")
    return head + "".join(part.title() for part in rest)


def _camelize(value: Any) -> Any:
    """Rewrite dict keys to camelCase so every read/edit result matches the GraphQL-style
    naming the other tools already use. PREPARE results are not passed through this (their
    ``parameters`` are an opaque echo payload)."""
    if isinstance(value, dict):
        return {
            (_camel_key(k) if isinstance(k, str) else k): _camelize(v) for k, v in value.items()
        }
    if isinstance(value, list):
        return [_camelize(v) for v in value]
    return value


def _reject_identity_args(value: Any) -> None:
    """Refuse any identity-bearing key anywhere in the arguments (recursively)."""
    if isinstance(value, dict):
        for key, nested in value.items():
            if isinstance(key, str) and key.lower() in RESERVED_IDENTITY_KEYS:
                raise DomainError(
                    ErrorCode.FORBIDDEN,
                    "tool arguments cannot set an owner, admin, project, session or run "
                    "identity; identity comes from the signed-in run",
                )
            _reject_identity_args(nested)
    elif isinstance(value, list | tuple):
        for item in value:
            _reject_identity_args(item)


@dataclass(frozen=True, slots=True)
class ToolResult:
    name: str
    kind: ToolKind
    step: int
    data: Json
    prepared: bool
    """True for PREPARE tools: ``data`` is a PreparedAction awaiting explicit UI confirmation,
    and nothing was changed by running the tool."""


@dataclass(slots=True)
class AgentToolRuntime:
    services: Services
    ctx: RequestContext
    """The verified request context; its principal is the only identity any tool runs as."""
    run_id: str
    _repeats: dict[tuple[str, str], int] = field(default_factory=dict, init=False)

    @property
    def _limits(self) -> AiLimits:
        return self.services.deps.ai.limits

    def catalogue(self) -> tuple[ToolSpec, ...]:
        return tuple(TOOLS_BY_NAME.values())

    def call(
        self, name: str, args: Json, *, prior_step: int | None = None, call_id: str | None = None
    ) -> ToolResult:
        """Run one tool call. When given, ``prior_step`` is the step the caller believes is
        current; a value that does not match the run's durable cursor is a replayed/old step
        and is refused. ``None`` claims the next step without that check (used by the ADK
        bridge, which advances the cursor itself). ``call_id`` is accepted for tracing (e.g.
        the ADK function-call id) and never affects identity."""
        principal = self.ctx.require_principal()
        spec = TOOLS_BY_NAME.get(name)
        if spec is None:
            raise DomainError(ErrorCode.VALIDATION_FAILED, f"unknown tool {name!r}")
        _reject_identity_args(args)
        run = self._claim_step(principal.uid, prior_step)
        self._guard_loop(name, args)
        payload = build(spec.args, args)
        run_ctx = RunContext(
            services=self.services, ctx=self.ctx, session_id=run.session_id, run_id=run.id
        )
        data = spec.handler(run_ctx, payload)
        prepared = spec.kind is ToolKind.PREPARE
        return ToolResult(
            name=name,
            kind=spec.kind,
            step=run.step_seq,
            data=data if prepared else _camelize(data),
            prepared=prepared,
        )

    def call_many(self, calls: list[tuple[str, Json]], *, prior_step: int) -> list[ToolResult]:
        """Run the tool calls one model turn requested. The number of calls is bounded by
        ``max_tool_fanout`` before any runs; the rest are refused."""
        if len(calls) > self._limits.max_tool_fanout:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED,
                f"too many tool calls at once (at most {self._limits.max_tool_fanout})",
            )
        results: list[ToolResult] = []
        step = prior_step
        for name, args in calls:
            result = self.call(name, args, prior_step=step)
            results.append(result)
            step = result.step
        return results

    def _guard_loop(self, name: str, args: Json) -> None:
        key = (name, _canonical(args))
        count = self._repeats.get(key, 0) + 1
        self._repeats[key] = count
        if count > self._limits.max_tool_repeats:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED,
                "this tool was already called with the same arguments; make progress or stop",
            )

    def _claim_step(self, uid: str, prior_step: int | None) -> AgentRun:
        """Authorize against the run's current record and claim the next monotonic step.

        A run that is expired or out of step budget is stopped (in its own committed
        transaction) and then refused; a run that is not owned, not running, or whose
        ``prior_step`` is behind the durable cursor (a replayed/old step) is refused. The
        claim itself is a compare-and-set, so concurrent calls cannot both take the same
        step. Expiry and the step cursor live on the run, so neither depends on a TTL sweep."""
        store, now = self.services.deps.store, self.services.deps.clock()
        rid = require_id(self.run_id, IdKind.AGENT_RUN)
        run = store.agent_runs.get(rid)
        if run is None or run.owner_uid != uid:
            raise not_found("agent run")
        if run.is_expired(now):
            self._stop_run(rid, AgentStopReason.EXPIRED, now)
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED, "this run has expired; start a new one"
            )
        if run.status is not AgentRunStatus.RUNNING:
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "this run has ended")
        if prior_step is not None and prior_step != run.step_seq:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED,
                "this step is out of date (an old or replayed step); refresh the run",
            )
        if run.tool_budget_reached:
            self._stop_run(rid, AgentStopReason.STEP_BUDGET, now)
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "this run reached its tool-step limit")

        def tx() -> AgentRun:
            current = store.agent_runs.get(rid)
            if current is None or current.status is not AgentRunStatus.RUNNING:
                raise DomainError(ErrorCode.PRECONDITION_FAILED, "this run has ended")
            if current.is_expired(now):
                raise DomainError(ErrorCode.PRECONDITION_FAILED, "this run has expired")
            if prior_step is not None and prior_step != current.step_seq:
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED,
                    "this step is out of date (an old or replayed step); refresh the run",
                )
            if current.tool_budget_reached:
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED, "this run reached its tool-step limit"
                )
            return store.agent_runs.replace(
                current.model_copy(update={"step_seq": current.step_seq + 1, "updated_at": now}),
                current.version,
            )

        return store.transaction(tx)

    def _stop_run(self, run_id: str, reason: AgentStopReason, now: Any) -> None:
        """Stop a RUNNING run with ``reason`` in its own transaction (idempotent), so the
        state is durably recorded before the refusal is raised to the caller."""
        store = self.services.deps.store

        def tx() -> None:
            run = store.agent_runs.get(run_id)
            if run is None or run.status is not AgentRunStatus.RUNNING:
                return
            store.agent_runs.replace(
                run.model_copy(
                    update={
                        "status": AgentRunStatus.STOPPED,
                        "stop_reason": reason,
                        "ended_at": now,
                        "updated_at": now,
                    }
                ),
                run.version,
            )

        store.transaction(tx)


class AgentActionService:
    """Executes a :class:`PreparedAction` when the product UI confirms it (the agent never
    does). The confirmation is bound to the resource's current version via the token, so a
    stale confirmation is refused, and every action routes through the same authorized
    application service the GraphQL API uses."""

    def __init__(self, services: Services) -> None:
        self._s = services

    def confirm(self, ctx: RequestContext, submitted: ConfirmActionInput) -> Json:
        ctx.require_principal()
        # 1. Token integrity: the token must match the action, resource, version and
        #    parameters exactly as submitted, so none of them can be tampered independently.
        expected = confirmation_token(
            submitted.kind,
            submitted.resource_id,
            submitted.expected_version,
            submitted.parameters,
        )
        if expected != submitted.confirmation_token:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED,
                "this confirmation does not match what was reviewed; review and confirm again",
            )
        # 2. Freshness: the version reviewed must still be the resource's current version, so
        #    a confirmation of a now-changed resource (a stale confirmation) is refused before
        #    any service is called.
        current_version = self._current_version(ctx, submitted)
        if submitted.expected_version != current_version:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED,
                "this changed since you reviewed it; review the current details and confirm again",
            )
        if submitted.kind in CAS_ACTIONS and submitted.expected_version is None:
            raise DomainError(ErrorCode.VALIDATION_FAILED, "a version is required to confirm this")
        return self._execute(ctx, submitted)

    def _current_version(self, ctx: RequestContext, s: ConfirmActionInput) -> int | None:
        """Read the resource's current version through the authorized service (a forged or
        unreadable id fails here as not-found), so the token is checked against live state."""
        store = self._s.deps.store
        match s.kind:
            case AgentActionKind.FINALIZE_REPORT:
                return self._s.sessions.get(ctx, _req(s.resource_id)).version
            case AgentActionKind.ARCHIVE_REPORT | AgentActionKind.START_TRACKING_PROJECT:
                return self._s.reports.get(ctx, _req(s.resource_id)).version
            case AgentActionKind.CREATE_COMMUNITY:
                return None
            case AgentActionKind.JOIN_COMMUNITY | AgentActionKind.ARCHIVE_COMMUNITY:
                return self._s.communities.get(_req(s.resource_id)).version
            case AgentActionKind.LEAVE_COMMUNITY:
                community_id = _req(s.parameters.get("community_id"))
                membership = self._s.communities.viewer_membership(ctx, community_id)
                if membership is None or not membership.is_active:
                    raise not_found("membership")
                return membership.version
            case AgentActionKind.UPDATE_MILESTONE:
                principal = ctx.require_principal()
                milestone = store.milestones.get(_req(s.resource_id))
                if milestone is None:
                    raise not_found("milestone")
                readable_project(store, milestone.project_id, principal)
                return milestone.version
            case AgentActionKind.RECORD_OBSERVATION:
                return self._s.tracking.project(ctx, _req(s.resource_id)).version
        raise DomainError(ErrorCode.VALIDATION_FAILED, "unknown action")  # pragma: no cover

    def _execute(self, ctx: RequestContext, s: ConfirmActionInput) -> Json:
        params = s.parameters
        match s.kind:
            case AgentActionKind.FINALIZE_REPORT:
                report = self._s.reports.finalize(
                    ctx,
                    {"session_id": _req(s.resource_id), "title": params["title"]},
                    self._idem(s),
                )
                return report.model_dump(mode="json")
            case AgentActionKind.ARCHIVE_REPORT:
                report = self._s.reports.archive(ctx, _req(s.resource_id), self._ver(s))
                return report.model_dump(mode="json")
            case AgentActionKind.CREATE_COMMUNITY:
                community = self._s.communities.create(ctx, params, self._idem(s))
                return community.model_dump(mode="json")
            case AgentActionKind.JOIN_COMMUNITY:
                membership = self._s.communities.join(
                    ctx, _req(params.get("community_id")), self._idem(s)
                )
                return membership.model_dump(mode="json")
            case AgentActionKind.LEAVE_COMMUNITY:
                membership = self._s.communities.leave(
                    ctx, _req(params.get("community_id")), self._ver(s)
                )
                return membership.model_dump(mode="json")
            case AgentActionKind.ARCHIVE_COMMUNITY:
                community = self._s.communities.archive(
                    ctx, _req(params.get("community_id")), self._ver(s)
                )
                return community.model_dump(mode="json")
            case AgentActionKind.START_TRACKING_PROJECT:
                project = self._s.tracking.start(ctx, params, self._idem(s))
                return project.model_dump(mode="json")
            case AgentActionKind.UPDATE_MILESTONE:
                milestone = self._s.tracking.update_milestone(
                    ctx,
                    _req(params.get("milestone_id")),
                    self._ver(s),
                    MilestoneStatus(params["status"]),
                )
                return milestone.model_dump(mode="json")
            case AgentActionKind.RECORD_OBSERVATION:
                observation = self._s.tracking.record_observation(ctx, params, self._idem(s))
                return observation.model_dump(mode="json")
        raise DomainError(ErrorCode.VALIDATION_FAILED, "unknown action")  # pragma: no cover

    @staticmethod
    def _idem(s: ConfirmActionInput) -> str:
        if not s.idempotency_key:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, "confirming this action needs an idempotency key"
            )
        return s.idempotency_key

    @staticmethod
    def _ver(s: ConfirmActionInput) -> int:
        if s.expected_version is None:  # pragma: no cover - checked in confirm()
            raise DomainError(ErrorCode.VALIDATION_FAILED, "a version is required to confirm this")
        return s.expected_version


def _req(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise DomainError(ErrorCode.VALIDATION_FAILED, "a required identifier is missing")
    return value
