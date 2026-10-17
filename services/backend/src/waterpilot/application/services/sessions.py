"""Planning sessions: one active session per user (no drafts, ADR 0002). Creating a
new session closes the previous active one; the client confirms before doing so."""

from __future__ import annotations

from typing import Any

from waterpilot.application.idempotency import run_once
from waterpilot.application.identity import RequestContext
from waterpilot.application.pagination import Page, PageArgs
from waterpilot.application.policies import active_membership, existing_community, owned_session
from waterpilot.application.repositories import Where
from waterpilot.application.services.common import Deps, build, page_of
from waterpilot.application.services.goals import GoalInput, require_valid
from waterpilot.application.services.options import (
    OptionService,
    ScenarioInput,
    require_valid_scenario,
)
from waterpilot.domain.communities import CommunityStatus
from waterpilot.domain.errors import DomainError, ErrorCode, not_found
from waterpilot.domain.ids import IdKind, new_id, require_id
from waterpilot.domain.planning import (
    Goal,
    PlanningMode,
    PlanningSession,
    PlanningStage,
    PlanOption,
    Scenario,
    SessionStatus,
    SiteProfile,
)
from waterpilot.domain.values import Frozen


class CreateSessionInput(Frozen):
    mode: PlanningMode
    area_id: str | None = None
    community_id: str | None = None


class SessionPatch(Frozen):
    """Only fields explicitly provided are applied (``model_fields_set``)."""

    area_id: str | None = None
    mode: PlanningMode | None = None
    stage: PlanningStage | None = None
    baseline_reviewed: bool | None = None
    goal: GoalInput | None = None
    scenario: ScenarioInput | None = None
    selected_plan_option_id: str | None = None
    site_profile: SiteProfile | None = None


_REQUIRED_WHEN_SET = ("mode", "stage", "baseline_reviewed")


class SessionService:
    def __init__(self, deps: Deps, options: OptionService) -> None:
        self._d = deps
        self._options = options

    def get(self, ctx: RequestContext, session_id: str) -> PlanningSession:
        principal = ctx.require_principal()
        return owned_session(self._d.store, require_id(session_id, IdKind.SESSION), principal)

    def current(self, ctx: RequestContext) -> PlanningSession | None:
        principal = ctx.require_principal()
        return self._d.store.sessions.first(
            {"owner_uid": principal.uid, "status": SessionStatus.ACTIVE.value}
        )

    def plan_options(
        self, ctx: RequestContext, session_id: str, page: PageArgs
    ) -> Page[PlanOption]:
        """Options for the session's current inputs only: an edit to location, goal or
        scenario clears earlier results from view (they stay stored, unselectable)."""
        session = self.get(ctx, session_id)
        where: Where = {"session_id": session.id, "inputs_revision": session.inputs_revision}
        return page_of(self._d.store.plan_options, where, page)

    def create(
        self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str
    ) -> PlanningSession:
        principal = ctx.require_principal()
        payload = build(CreateSessionInput, data)
        self._validate_area(payload.area_id, principal.uid)
        if payload.community_id is not None:
            require_id(payload.community_id, IdKind.COMMUNITY, "communityId")
        store, now = self._d.store, self._d.clock()

        def create() -> tuple[str, ...]:
            if payload.community_id is not None:
                if active_membership(store, payload.community_id, principal.uid) is None:
                    raise not_found("community")
                community = existing_community(store, payload.community_id)
                if community.status is CommunityStatus.ARCHIVED:
                    raise DomainError(
                        ErrorCode.ARCHIVED, "this community is archived; start a personal plan"
                    )
            previous = self.current(ctx)
            if previous is not None:
                store.sessions.replace(
                    previous.model_copy(update={"status": SessionStatus.CLOSED, "updated_at": now}),
                    previous.version,
                )
            session = PlanningSession(
                id=new_id(IdKind.SESSION),
                owner_uid=principal.uid,
                community_id=payload.community_id,
                area_id=payload.area_id,
                mode=payload.mode,
                created_at=now,
                updated_at=now,
            )
            return (store.sessions.insert(session).id,)

        def tx() -> tuple[str, ...]:
            store.lock_owner(principal.uid)  # one active session per user
            return run_once(
                store,
                uid=principal.uid,
                operation="createPlanningSession",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )

        (session_id,) = store.transaction(tx)
        return owned_session(store, session_id, principal)

    def update(
        self,
        ctx: RequestContext,
        session_id: str,
        expected_version: int,
        data: dict[str, Any],
    ) -> PlanningSession:
        principal = ctx.require_principal()
        patch = build(SessionPatch, data)
        store = self._d.store
        session_id = require_id(session_id, IdKind.SESSION)
        if patch.scenario is not None:
            require_valid_scenario(patch.scenario)
        if "selected_plan_option_id" in patch.model_fields_set:
            self._store_selected(ctx, session_id, patch.selected_plan_option_id)

        def tx() -> PlanningSession:
            session = owned_session(store, session_id, principal)
            session.require_version(expected_version)
            if session.status is not SessionStatus.ACTIVE:
                raise DomainError(ErrorCode.PRECONDITION_FAILED, "this session is closed")
            update = self._apply(session, patch)
            update["updated_at"] = self._d.clock()
            return store.sessions.replace(session.model_copy(update=update), expected_version)

        return store.transaction(tx)

    def _store_selected(self, ctx: RequestContext, session_id: str, option_id: str | None) -> None:
        """Options are computed, not stored; selecting one stores it, and only when it is
        among the options for the session's current inputs. Options stored before the
        engine (no comparison id) keep the revision rule in ``_apply``."""
        if option_id is None:
            return
        require_id(option_id, IdKind.PLAN_OPTION, "selectedPlanOptionId")
        stored = self._d.store.plan_options.get(option_id)
        if stored is not None and stored.comparison_id is None:
            return
        record = self._options.selectable(ctx, session_id, option_id)
        # Choosing again stores the assessment the person sees now: the option id comes
        # from the comparison key, which does not cover evidence or nearby places.
        if (
            stored is None
            or stored.inputs_revision != record.inputs_revision
            or stored.impact.wider != record.impact.wider
        ):
            self._d.store.plan_options.add(record)

    def _apply(self, session: PlanningSession, patch: SessionPatch) -> dict[str, Any]:
        provided = patch.model_fields_set
        for name in _REQUIRED_WHEN_SET:
            if name in provided and getattr(patch, name) is None:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, f"{name} cannot be cleared", field=name
                )
        update: dict[str, Any] = {}
        if "mode" in provided:
            update["mode"] = patch.mode
        if "stage" in provided:
            update["stage"] = patch.stage
        if "baseline_reviewed" in provided:
            if patch.baseline_reviewed and not (patch.area_id or session.area_id):
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "choose a location first", field="baselineReviewed"
                )
            update["baseline_reviewed"] = patch.baseline_reviewed
        if "site_profile" in provided:
            # Descriptive only: it changes no calculation, so it never bumps the revision.
            update["site_profile"] = patch.site_profile
        # Upstream inputs. Only a real change counts, so re-sending the same value (a
        # retried or merged edit) never invalidates derived results.
        upstream_changed = False
        if "area_id" in provided and patch.area_id != session.area_id:
            self._validate_area(patch.area_id, session.owner_uid)
            # A new location invalidates the scenario and any selected plan.
            update |= {
                "area_id": patch.area_id,
                "scenario": None,
                "selected_plan_option_id": None,
                "baseline_reviewed": False,
            }
            upstream_changed = True
        if "goal" in provided:
            if patch.goal is not None:
                require_valid(patch.goal)
            goal = (
                None
                if patch.goal is None
                else Goal(
                    id=session.goal.id if session.goal else new_id(IdKind.GOAL),
                    **patch.goal.model_dump(),
                )
            )
            if goal != session.goal:
                # Plans are compared against the goal, so the selection no longer holds.
                update |= {"goal": goal, "selected_plan_option_id": None}
                upstream_changed = True
        if "scenario" in provided:
            scenario = (
                None
                if patch.scenario is None
                else Scenario(
                    id=session.scenario.id if session.scenario else new_id(IdKind.SCENARIO),
                    **patch.scenario.model_dump(),
                )
            )
            if scenario != session.scenario:
                # Options are compared under the scenario, so the selection no longer holds.
                update |= {"scenario": scenario, "selected_plan_option_id": None}
                upstream_changed = True
        revision = session.inputs_revision + 1 if upstream_changed else session.inputs_revision
        if upstream_changed:
            update["inputs_revision"] = revision
        if "selected_plan_option_id" in provided:
            option_id = patch.selected_plan_option_id
            if option_id is not None:
                require_id(option_id, IdKind.PLAN_OPTION, "selectedPlanOptionId")
                option = self._d.store.plan_options.get(option_id)
                if option is None or option.session_id != session.id:
                    raise DomainError(
                        ErrorCode.VALIDATION_FAILED,
                        "the selected plan is not part of this session",
                        field="selectedPlanOptionId",
                    )
                if option.inputs_revision != revision:
                    raise DomainError(
                        ErrorCode.PRECONDITION_FAILED,
                        "this plan was calculated for earlier inputs; recalculate plans first",
                        field="selectedPlanOptionId",
                    )
            update["selected_plan_option_id"] = option_id
        return update

    def _validate_area(self, area_id: str | None, owner_uid: str) -> None:
        if area_id is None:
            return
        require_id(area_id, IdKind.AREA, "areaId")
        area = self._d.store.areas.get(area_id)
        if area is None or not area.visible_to(owner_uid):
            raise DomainError(ErrorCode.VALIDATION_FAILED, "unknown location", field="areaId")
