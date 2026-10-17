"""The AI model gateway (ADR 0015).

Every model call goes through here. The gateway:

- refuses when AI is disabled (kill switch, not enabled, no provider), the account is not an
  invited tester, no budget is configured, or the daily request/budget ceiling is reached;
- bounds one run per session and the model calls per run (a Continue checkpoint, then an
  absolute cap);
- reserves the worst-case estimated cost **atomically** before the call, so concurrent
  calls cannot overspend, and a replayed reserve (same call key) returns the same hold and
  never double-counts;
- calls the provider with a timeout, a bounded retry for transient errors and cooperative
  cancellation;
- validates the model's structured output against the caller's schema;
- reconciles the actual reported usage (settling the hold to the real cost) on success; on a
  failure it releases the hold only when the request was never dispatched, and otherwise
  settles conservatively at the worst case (never released, never replayed) pending a later
  reconciliation that may raise or lower it. Crash-orphaned holds are swept the same way.

Nothing here enables billing or assumes a free tier; costs are deterministic estimates in
micro-USD, not an invoice. Ordinary planning never calls the gateway, so planning works
whether or not AI is available.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel, ValidationError

from waterpilot.application.deadline import deadline, remaining
from waterpilot.application.idempotency import run_once
from waterpilot.application.identity import RequestContext
from waterpilot.application.pagination import PageArgs
from waterpilot.application.policies import owned_session
from waterpilot.application.ports import (
    ModelCallError,
    ModelCancelled,
    ModelRequest,
    ModelResponse,
)
from waterpilot.application.services.common import Deps
from waterpilot.domain.ai import (
    AiStatus,
    AiUnavailableReason,
    ModelInfo,
    ModelTask,
    ReservationStatus,
    UsageActual,
    UsageCallKey,
    UsageDay,
    UsageEstimate,
    UsageReservation,
    call_key_tombstone_id,
    model_info,
    reservation_id_for,
    usage_day_id,
)
from waterpilot.domain.embeddings import EMBEDDING_INFO
from waterpilot.domain.errors import DomainError, ErrorCode, not_found
from waterpilot.domain.ids import IdKind, new_id, require_id
from waterpilot.domain.jobs import AgentRun, AgentRunStatus, AgentStopReason
from waterpilot.domain.values import Frozen


def estimate_tokens(text: str) -> int:
    """A deterministic, conservative token estimate (~4 characters per token, plus a small
    fixed overhead). Used only to size the reservation; the real count comes from the
    provider and is reconciled afterwards."""
    return max(1, (len(text) + 3) // 4) + 8


@dataclass(frozen=True, slots=True)
class AiResult:
    output: BaseModel
    usage: UsageReservation
    model_id: str
    retries: int


@dataclass(frozen=True, slots=True)
class TextResult:
    """A free-text model result (no response schema). Used by the ADK model bridge, which
    must route every call through this gateway rather than its own client."""

    text: str
    usage: UsageReservation
    model_id: str
    retries: int


@dataclass(frozen=True, slots=True)
class _Dispatched:
    """A successful provider call that has not yet been settled: the shared result of the
    reserve/dispatch/retry path, so structured-output and free-text callers settle it the
    same way."""

    info: ModelInfo
    reservation: UsageReservation
    response: ModelResponse
    retries: int
    run_id: str


@dataclass(frozen=True, slots=True)
class ExpiredSweep:
    """Outcome of one crash-recovery sweep of expired holds. ``released`` holds were proven
    never dispatched (nothing billed); ``settled`` holds were dispatched or uncertain and were
    settled conservatively at the worst case (never released)."""

    released: int = 0
    settled: int = 0


@dataclass(slots=True)
class _CallState:
    """Tracks, across the bounded retry loop, whether any attempt reached the provider.

    ``dispatched`` becomes True the moment a request is handed to the provider. A failure or
    cancellation while ``dispatched`` is False (e.g. the caller cancelled before the first
    attempt was sent) proves no billable usage, so the hold is released. Once ``dispatched``
    is True the outcome is ambiguous — a timeout, a cancellation after dispatch, or transient
    errors that exhausted the retry budget may still have incurred usage — so the hold is
    settled conservatively instead of released, and the call is never replayed."""

    dispatched: bool = False
    retries: int = 0


class _StartRunInput(Frozen):
    session_id: str
    prompt: str = ""


class AiGateway:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def embedding_policy(self, ctx: RequestContext) -> AiGateway:
        cfg = self._d.ai
        child = AiGateway(replace(self._d, ai=replace(cfg, provider=cfg.embedding_provider)))
        child._require_available(ctx.require_principal().uid)
        return child

    def embed(self, ctx: RequestContext, text: str, call_key: str, *, query: bool) -> str:
        """Shared durable budget ledger; no conversation run, no retry after dispatch.

        Concurrent embedding duplicates must win a single atomic dispatch claim. Unknown
        outcomes settle conservatively and never repeat a provider request.
        """
        child = self.embedding_policy(ctx)
        tokens = len(text.encode())  # conservative UTF-8-byte bound, not an invoice
        if tokens > self._d.ai.limits.max_input_tokens:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, "embedding input exceeds the token ceiling"
            )
        task = ModelTask.EMBEDDING_QUERY if query else ModelTask.EMBEDDING_DOCUMENT
        info = EMBEDDING_INFO
        reservation = child._reserve(
            ctx.require_principal().uid,
            info,
            task,
            UsageEstimate(
                model_id=info.model_id,
                task=task,
                input_tokens=tokens,
                max_output_tokens=0,
                max_attempts=1,
            ),
            call_key,
            None,
            self._d.clock(),
        )
        if reservation.status is not ReservationStatus.RESERVED or not child._mark_dispatched(
            reservation
        ):
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED, "embedding request was already processed"
            )
        try:
            timeout = min(self._d.ai.limits.request_timeout_seconds, remaining(), 10)
            response = child._d.ai.provider.generate(
                ModelRequest(
                    model_id=info.model_id,
                    task=task.value,
                    prompt=text,
                    max_output_tokens=0,
                    timeout_seconds=timeout,
                )
            )
        except Exception as err:
            child._settle_estimated(reservation, None, 0)
            raise DomainError(
                ErrorCode.SERVICE_UNAVAILABLE, "embedding ranking unavailable"
            ) from err
        if self._d.embedding_version.startswith("fake-"):
            child._commit(reservation, UsageActual(input_tokens=tokens), info, None)
        else:
            # No verified provider token meter yet: retain a conservative estimate for
            # reconciliation, never label our byte ceiling as an actual cloud invoice.
            child._settle_estimated(reservation, None, 0)
        return response.text

    # ---------------------------------------------------------------- status

    def status(self, ctx: RequestContext) -> AiStatus:
        principal = ctx.require_principal()
        cfg, limits = self._d.ai, self._d.ai.limits
        day = self._today()
        day_doc = self._d.store.usage_days.get(usage_day_id(day))
        used = day_doc.request_count if day_doc else 0
        base = AiStatus(
            available=True,
            reason=None,
            model_id=cfg.model,
            requests_remaining=max(0, limits.daily_request_limit - used),
            daily_request_limit=limits.daily_request_limit,
            budget_configured=limits.daily_budget_micro_usd is not None,
        )
        reason = self._unavailable_reason(principal.uid, day_doc)
        return base if reason is None else base.with_reason(reason)

    def _unavailable_reason(self, uid: str, day_doc: UsageDay | None) -> AiUnavailableReason | None:
        cfg, limits = self._d.ai, self._d.ai.limits
        if cfg.kill_switch or not cfg.enabled or not cfg.provider.available:
            return AiUnavailableReason.DISABLED
        if not cfg.open_to_all and uid not in cfg.invited:
            return AiUnavailableReason.NOT_INVITED
        if limits.daily_budget_micro_usd is None:
            return AiUnavailableReason.NO_BUDGET_CONFIGURED
        used = day_doc.request_count if day_doc else 0
        committed = day_doc.committed_micro_usd if day_doc else 0
        if used >= limits.daily_request_limit or committed >= limits.daily_budget_micro_usd:
            return AiUnavailableReason.BUDGET_EXHAUSTED
        return None

    def _require_available(self, uid: str) -> None:
        day_doc = self._d.store.usage_days.get(usage_day_id(self._today()))
        reason = self._unavailable_reason(uid, day_doc)
        if reason is None:
            return
        if reason is AiUnavailableReason.NOT_INVITED:
            raise DomainError(ErrorCode.FORBIDDEN, "AI help is limited to invited testers")
        if reason is AiUnavailableReason.BUDGET_EXHAUSTED:
            raise DomainError(
                ErrorCode.BUDGET_EXHAUSTED,
                "the daily AI allowance is used up; please try again tomorrow",
            )
        raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "AI help is currently unavailable")

    # ---------------------------------------------------------------- runs

    def start_run(
        self, ctx: RequestContext, session_id: str, idempotency_key: str, prompt: str = ""
    ) -> AgentRun:
        principal = ctx.require_principal()
        self._require_available(principal.uid)
        store, limits, now = self._d.store, self._d.ai.limits, self._d.clock()
        sid = require_id(session_id, IdKind.SESSION)

        def create() -> tuple[str, ...]:
            session = owned_session(store, sid, principal)
            if self._active_run(session.id) is not None:
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED,
                    "a run is already in progress for this session; finish or stop it first",
                )
            run = AgentRun(
                prompt=prompt,
                id=new_id(IdKind.AGENT_RUN),
                owner_uid=principal.uid,
                session_id=session.id,
                max_tool_calls=limits.hard_calls_per_run,
                max_calls_before_checkpoint=limits.max_calls_per_run,
                max_output_tokens=limits.default_max_output_tokens,
                max_tool_steps=limits.max_tool_steps_per_run,
                expires_at=now + timedelta(seconds=limits.run_ttl_seconds),
                created_at=now,
                updated_at=now,
            )
            return (store.agent_runs.insert(run).id,)

        def tx() -> tuple[str, ...]:
            store.lock_owner(principal.uid)
            return run_once(
                store,
                uid=principal.uid,
                operation="startAgentRun",
                key=idempotency_key,
                payload=_StartRunInput(session_id=sid, prompt=prompt),
                now=now,
                create=create,
            )

        (rid,) = store.transaction(tx)
        run = store.agent_runs.get(rid)
        assert run is not None
        return run

    def continue_run(self, ctx: RequestContext, run_id: str, expected_version: int) -> AgentRun:
        """A user Continue past a checkpoint: resume the run and clear the per-checkpoint
        call counter so the next window of calls may proceed."""
        principal = ctx.require_principal()
        store, now = self._d.store, self._d.clock()
        rid = require_id(run_id, IdKind.AGENT_RUN)

        def tx() -> AgentRun:
            run = self._owned_run(rid, principal.uid)
            run.require_version(expected_version)
            if run.status is not AgentRunStatus.RUNNING:
                raise DomainError(ErrorCode.PRECONDITION_FAILED, "this run has ended")
            return store.agent_runs.replace(
                run.model_copy(update={"calls_since_checkpoint": 0, "updated_at": now}),
                expected_version,
            )

        return store.transaction(tx)

    def stop_run(self, ctx: RequestContext, run_id: str, expected_version: int) -> AgentRun:
        principal = ctx.require_principal()
        store, now = self._d.store, self._d.clock()
        rid = require_id(run_id, IdKind.AGENT_RUN)

        def tx() -> AgentRun:
            run = self._owned_run(rid, principal.uid)
            run.require_version(expected_version)
            if run.status is not AgentRunStatus.RUNNING:
                return run
            return store.agent_runs.replace(
                run.model_copy(
                    update={
                        "status": AgentRunStatus.STOPPED,
                        "stop_reason": AgentStopReason.CANCELLED,
                        "ended_at": now,
                        "updated_at": now,
                    }
                ),
                expected_version,
            )

        return store.transaction(tx)

    def _owned_run(self, run_id: str, uid: str) -> AgentRun:
        run = self._d.store.agent_runs.get(run_id)
        if run is None or run.owner_uid != uid:
            raise not_found("agent run")
        return run

    def _expire_run(self, run_id: str) -> None:
        """Mark an expired run STOPPED (idempotent). Expiry is judged from the run's own
        ``expires_at`` before this runs, so a model call is refused even if this bookkeeping
        write has not happened yet (it does not depend on any TTL sweep)."""
        store, now = self._d.store, self._d.clock()

        def tx() -> None:
            run = store.agent_runs.get(run_id)
            if run is None or run.status is not AgentRunStatus.RUNNING:
                return
            store.agent_runs.replace(
                run.model_copy(
                    update={
                        "status": AgentRunStatus.STOPPED,
                        "stop_reason": AgentStopReason.EXPIRED,
                        "ended_at": now,
                        "updated_at": now,
                    }
                ),
                run.version,
            )

        store.transaction(tx)

    def _active_run(self, session_id: str) -> AgentRun | None:
        """The session's most recent run if it is still RUNNING. There is never more than
        one RUNNING run per session, so the newest run is the only candidate (uses the
        existing ``agentRuns(session_id)`` index, no status filter)."""
        where = {"session_id": session_id}
        page = self._d.store.agent_runs.page(where, PageArgs(first=1).bind(where))
        top = page.items[0] if page.items else None
        return top if top is not None and top.status is AgentRunStatus.RUNNING else None

    # ---------------------------------------------------------------- generate

    def generate(
        self,
        ctx: RequestContext,
        *,
        run_id: str,
        task: ModelTask,
        prompt: str,
        response_model: type[BaseModel],
        call_key: str,
        max_output_tokens: int | None = None,
        is_cancelled: Callable[[], bool] | None = None,
        estimated_input_tokens: int | None = None,
    ) -> AiResult:
        """Run one structured-output model call under the full policy. ``call_key`` makes
        the reservation idempotent: the same key never spends twice."""
        dispatched = self._dispatch(
            ctx,
            run_id=run_id,
            task=task,
            prompt=prompt,
            call_key=call_key,
            response_schema=response_model.model_json_schema(),
            max_output_tokens=max_output_tokens,
            is_cancelled=is_cancelled,
            estimated_input_tokens=estimated_input_tokens,
        )
        actual = self._actual_from(dispatched)
        try:
            output = response_model.model_validate_json(dispatched.response.text)
        except ValidationError as err:
            # Tokens were billed, so settle the real cost; then report the invalid output.
            self._commit(dispatched.reservation, actual, dispatched.info, dispatched.run_id)
            raise DomainError(
                ErrorCode.VALIDATION_FAILED,
                "the assistant did not return a usable answer; please try again",
            ) from err
        settled = self._commit(dispatched.reservation, actual, dispatched.info, dispatched.run_id)
        return AiResult(
            output=output,
            usage=settled,
            model_id=dispatched.info.model_id,
            retries=dispatched.retries,
        )

    def complete_text(
        self,
        ctx: RequestContext,
        *,
        run_id: str,
        task: ModelTask,
        prompt: str,
        call_key: str,
        max_output_tokens: int | None = None,
        is_cancelled: Callable[[], bool] | None = None,
        estimated_input_tokens: int | None = None,
    ) -> TextResult:
        """Run one free-text model call under the full policy, returning the raw text. The
        ADK model bridge calls this so every ADK model call is reserved, retry-bounded,
        kill-switch-gated and settled here — it never reaches a provider another way."""
        dispatched = self._dispatch(
            ctx,
            run_id=run_id,
            task=task,
            prompt=prompt,
            call_key=call_key,
            response_schema=None,
            max_output_tokens=max_output_tokens,
            is_cancelled=is_cancelled,
            estimated_input_tokens=estimated_input_tokens,
        )
        settled = self._commit(
            dispatched.reservation,
            self._actual_from(dispatched),
            dispatched.info,
            dispatched.run_id,
        )
        return TextResult(
            text=dispatched.response.text,
            usage=settled,
            model_id=dispatched.info.model_id,
            retries=dispatched.retries,
        )

    @staticmethod
    def _actual_from(dispatched: _Dispatched) -> UsageActual:
        usage = dispatched.response.usage
        return UsageActual(
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            thinking_tokens=usage.thinking_tokens,
            cached_input_tokens=usage.cached_input_tokens,
            retries=dispatched.retries,
        )

    def _dispatch(
        self,
        ctx: RequestContext,
        *,
        run_id: str,
        task: ModelTask,
        prompt: str,
        call_key: str,
        response_schema: dict[str, Any] | None,
        max_output_tokens: int | None,
        is_cancelled: Callable[[], bool] | None,
        estimated_input_tokens: int | None,
    ) -> _Dispatched:
        """The shared reserve → dispatch → bounded-retry path, up to a successful provider
        response (not yet settled). Both ``generate`` and ``complete_text`` call it, so the
        budget, retry, cancellation and crash-accounting rules are enforced once."""
        principal = ctx.require_principal()
        self._require_available(principal.uid)
        info = model_info(self._d.ai.model)
        if info is None:  # pragma: no cover - settings validation guarantees a known model
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "AI help is currently unavailable")
        limits = self._d.ai.limits
        rid = require_id(run_id, IdKind.AGENT_RUN)
        run = self._owned_run(rid, principal.uid)
        if run.is_expired(self._d.clock()):
            self._expire_run(rid)
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED, "this run has expired; start a new one"
            )
        if run.status is not AgentRunStatus.RUNNING:
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "this run has ended; start a new one")
        if run.needs_continue:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED,
                "the assistant paused for you to review; choose Continue to go on",
            )
        max_out = limits.output_limit(task, max_output_tokens)
        est_in = (
            estimated_input_tokens
            if estimated_input_tokens is not None
            else estimate_tokens(prompt)
        )
        if est_in > limits.max_input_tokens:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, "this request is too long for a single model call"
            )
        estimate = UsageEstimate(
            model_id=info.model_id,
            task=task,
            input_tokens=est_in,
            max_output_tokens=max_out,
            # The hold must cover every permitted dispatched attempt (initial + retries),
            # since each attempt is independently billable.
            max_attempts=limits.transient_retries + 1,
        )
        now = self._d.clock()
        reservation = self._reserve(principal.uid, info, task, estimate, call_key, rid, now)
        if reservation.status is not ReservationStatus.RESERVED:
            # A replay of a call key that already settled or released: do not call the model
            # again and do not spend again.
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "this request was already processed")
        if reservation.dispatched:
            # A still-RESERVED hold that was already dispatched is either an in-flight
            # duplicate or an interrupted/crashed call. Never replay it. Leave the hold in
            # place: the dispatching worker settles it to the real cost, or (if abandoned) the
            # expiry sweep settles it conservatively. Either way it stays counted against the
            # budget while held, so refusing here cannot cause overspend or a double charge.
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "this request was already processed")

        request = ModelRequest(
            model_id=info.model_id,
            task=task.value,
            prompt=prompt,
            max_output_tokens=max_out,
            response_schema=response_schema,
            temperature=0.0,
            timeout_seconds=limits.request_timeout_seconds,
        )
        state = _CallState()
        try:
            resp = self._call_with_retry(request, is_cancelled, state, reservation)
        except ModelCancelled:
            self._resolve_failure(reservation, rid, state)
            raise
        except ModelCallError as err:
            self._resolve_failure(reservation, rid, state)
            raise DomainError(
                ErrorCode.SERVICE_UNAVAILABLE, "the model could not be reached; please try again"
            ) from err
        return _Dispatched(
            info=info,
            reservation=reservation,
            response=resp,
            retries=state.retries,
            run_id=rid,
        )

    def _call_with_retry(
        self,
        request: ModelRequest,
        is_cancelled: Callable[[], bool] | None,
        state: _CallState,
        reservation: UsageReservation,
    ) -> ModelResponse:
        while True:
            if is_cancelled is not None and is_cancelled():
                # Cancelled before this attempt reached the provider; ``state.dispatched``
                # tells the caller whether an earlier attempt was already sent.
                raise ModelCancelled()
            try:
                if not state.dispatched:
                    # Record the dispatch intent durably *before* the provider is reached, so
                    # a crash from here on leaves a hold that is provably dispatched (settled
                    # conservatively) rather than looking never-dispatched (wrongly released).
                    if not self._mark_dispatched(reservation):
                        raise DomainError(
                            ErrorCode.PRECONDITION_FAILED, "model request already dispatched"
                        )
                    state.dispatched = True
                attempt_request = (
                    replace(request, timeout_seconds=min(request.timeout_seconds, remaining()))
                    if deadline.get() is not None
                    else request
                )
                return self._d.ai.provider.generate(attempt_request, is_cancelled=is_cancelled)
            except ModelCallError as err:
                if not err.transient or state.retries >= self._d.ai.limits.transient_retries:
                    raise
                state.retries += 1

    def _mark_dispatched(self, reservation: UsageReservation) -> bool:
        """Persist that a request for this hold has been handed to the provider. Idempotent:
        it writes only while the hold is still ``RESERVED`` and not yet marked."""
        store, now = self._d.store, self._d.clock()

        def tx() -> bool:
            current = store.usage_reservations.get(reservation.id)
            if (
                current is None
                or current.status is not ReservationStatus.RESERVED
                or current.dispatched
            ):
                return False
            store.usage_reservations.replace(
                current.model_copy(update={"dispatched": True, "updated_at": now}),
                current.version,
            )

            return True

        return store.transaction(tx)

    def _resolve_failure(
        self, reservation: UsageReservation, run_id: str, state: _CallState
    ) -> None:
        """Resolve the hold for a failed or cancelled call. If no request ever reached the
        provider, release the hold (nothing was billed). If a request was dispatched, the
        outcome is ambiguous, so settle conservatively at the reserved estimate and leave it
        for reconciliation — never release and never replay (close-out directive 3)."""
        if not state.dispatched:
            self._release(reservation)
        else:
            self._settle_estimated(reservation, run_id, state.retries)

    def _settle_estimated(
        self, reservation: UsageReservation, run_id: str | None, retries: int
    ) -> None:
        """Conservatively settle a dispatched-but-ambiguous call at its reserved worst-case
        cost. Idempotent on the status transition, like ``_commit``/``_release``."""
        store, now = self._d.store, self._d.clock()

        def tx() -> None:
            current = store.usage_reservations.get(reservation.id)
            if current is None or current.status is not ReservationStatus.RESERVED:
                return
            micro = current.reserved_micro_usd  # worst case: assume the full reservation was used
            self._apply_day(
                current.day,
                request_delta=0,
                reserved_delta=-current.reserved_micro_usd,
                settled_delta=micro,
                now=now,
            )
            store.usage_reservations.replace(
                current.model_copy(
                    update={
                        "status": ReservationStatus.SETTLED,
                        "settled_micro_usd": micro,
                        "estimated": True,
                        "retries": retries,
                        "due_at": None,
                        "settled_at": now,
                        "updated_at": now,
                    }
                ),
                current.version,
            )
            self._advance_run(run_id, now)
            self._write_tombstone(current.id, ReservationStatus.SETTLED, now)

        store.transaction(tx)

    # ---------------------------------------------------------------- ledger

    def _write_tombstone(
        self, reservation_id: str, outcome: ReservationStatus, now: datetime
    ) -> None:
        """Write a durable, minimal tombstone that this call key reached a terminal outcome,
        so a replay is refused even after the reservation record is cleaned up (its retention
        lapses) and even though conversation events are bounded and trimmed. Called inside the
        settling/releasing transaction; idempotent (the terminal transition happens once, and
        a tombstone that already exists is left as-is)."""
        store = self._d.store
        tomb_id = call_key_tombstone_id(reservation_id)
        if store.usage_call_keys.get(tomb_id) is not None:
            return
        store.usage_call_keys.insert(
            UsageCallKey(id=tomb_id, outcome=outcome, created_at=now, updated_at=now)
        )

    def _reserve(
        self,
        uid: str,
        info: ModelInfo,
        task: ModelTask,
        estimate: UsageEstimate,
        call_key: str,
        run_id: str | None,
        now: datetime,
    ) -> UsageReservation:
        store, limits = self._d.store, self._d.ai.limits
        day = self._today()
        res_id = reservation_id_for(call_key)
        micro = estimate.reserved_micro_usd(info)
        ttl = timedelta(seconds=limits.reservation_ttl_seconds)
        budget = limits.daily_budget_micro_usd
        assert budget is not None  # _require_available guaranteed a budget is configured

        def tx() -> UsageReservation:
            existing = store.usage_reservations.get(res_id)
            if existing is not None:
                return existing  # idempotent: a replayed reserve never double-counts
            if store.usage_call_keys.get(call_key_tombstone_id(res_id)) is not None:
                # The detailed reservation was cleaned up (its 7-day retention lapsed), but a
                # durable tombstone proves this call key already reached a terminal outcome.
                # Refuse the replay without reserving or dispatching — dedup here does not
                # depend on the reservation record or on any retained conversation event.
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED, "this request was already processed"
                )
            day_doc = store.usage_days.get(usage_day_id(day))
            used = day_doc.request_count if day_doc else 0
            committed = day_doc.committed_micro_usd if day_doc else 0
            if used >= limits.daily_request_limit:
                raise DomainError(
                    ErrorCode.BUDGET_EXHAUSTED,
                    "the daily AI request limit is reached; please try again tomorrow",
                )
            if committed + micro > budget:
                raise DomainError(
                    ErrorCode.BUDGET_EXHAUSTED,
                    "the daily AI budget is reached; please try again tomorrow",
                )
            reservation = UsageReservation(
                id=res_id,
                owner_uid=uid,
                day=day,
                model_id=info.model_id,
                task=task,
                run_id=run_id,
                reserved_micro_usd=micro,
                reserved_tokens=estimate.reserved_tokens(),
                due_at=now + ttl,
                created_at=now,
                updated_at=now,
            )
            store.usage_reservations.insert(reservation)
            self._apply_day(day, request_delta=1, reserved_delta=micro, settled_delta=0, now=now)
            return reservation

        return store.transaction(tx)

    def _commit(
        self,
        reservation: UsageReservation,
        actual: UsageActual,
        info: ModelInfo,
        run_id: str | None,
    ) -> UsageReservation:
        store, now = self._d.store, self._d.clock()
        micro = actual.settled_micro_usd(info)

        def tx() -> UsageReservation:
            current = store.usage_reservations.get(reservation.id)
            if current is None or current.status is not ReservationStatus.RESERVED:
                return current if current is not None else reservation
            self._apply_day(
                current.day,
                request_delta=0,
                reserved_delta=-current.reserved_micro_usd,
                settled_delta=micro,
                now=now,
            )
            settled = current.model_copy(
                update={
                    "status": ReservationStatus.SETTLED,
                    "settled_micro_usd": micro,
                    "actual_input_tokens": actual.input_tokens,
                    "actual_output_tokens": actual.output_tokens,
                    "retries": actual.retries,
                    "due_at": None,
                    "settled_at": now,
                    "updated_at": now,
                }
            )
            store.usage_reservations.replace(settled, current.version)
            self._advance_run(run_id, now)
            self._write_tombstone(current.id, ReservationStatus.SETTLED, now)
            return settled

        return store.transaction(tx)

    def _release(self, reservation: UsageReservation) -> None:
        store, now = self._d.store, self._d.clock()

        def tx() -> None:
            current = store.usage_reservations.get(reservation.id)
            if current is None or current.status is not ReservationStatus.RESERVED:
                return
            self._apply_day(
                current.day,
                request_delta=0,
                reserved_delta=-current.reserved_micro_usd,
                settled_delta=0,
                now=now,
            )
            store.usage_reservations.replace(
                current.model_copy(
                    update={
                        "status": ReservationStatus.RELEASED,
                        "due_at": None,
                        "updated_at": now,
                    }
                ),
                current.version,
            )
            self._write_tombstone(current.id, ReservationStatus.RELEASED, now)

        store.transaction(tx)

    def reconcile_expired(self, limit: int = 100) -> ExpiredSweep:
        """Crash recovery: resolve holds left ``RESERVED`` past their expiry (a crash between
        reserve and settle). A hold is released **only if it was never dispatched** (its
        persisted ``dispatched`` flag proves no request was sent, so nothing was billed). A
        dispatched — hence uncertain — hold may have incurred billable usage, so it is settled
        conservatively at the worst case and never released or replayed. Call outside a
        transaction, re-checking each hold inside its own."""
        store, now = self._d.store, self._d.clock()
        released = settled = 0
        for reservation in store.usage_reservations.due(now, limit):
            if reservation.status is not ReservationStatus.RESERVED:
                continue
            if reservation.dispatched:
                self._settle_estimated(reservation, reservation.run_id, reservation.retries)
                settled += 1
            else:
                self._release(reservation)
                released += 1
        return ExpiredSweep(released=released, settled=settled)

    def reconcile_usage(
        self, reservation_id: str, evidence: UsageActual
    ) -> UsageReservation | None:
        """Resolve a conservatively-settled (``estimated``) hold against evidenced actual
        usage. The adjustment may **raise or lower** the recorded charge — a dispatched call
        that was settled at the worst case can turn out to have used more or less than the
        estimate, so this never assumes actual usage can only be lower. The day's settled
        total moves by the signed delta, and clearing ``estimated`` makes the record eligible
        for retention/TTL. Idempotent: a hold that is not an unresolved estimate is unchanged."""
        store, now = self._d.store, self._d.clock()

        def tx() -> UsageReservation | None:
            current = store.usage_reservations.get(reservation_id)
            if (
                current is None
                or current.status is not ReservationStatus.SETTLED
                or not current.estimated
            ):
                return current
            model = model_info(current.model_id)
            if model is None:  # pragma: no cover - a stored reservation always names a model
                raise DomainError(
                    ErrorCode.SERVICE_UNAVAILABLE, "unknown model for usage reconciliation"
                )
            new_micro = evidence.settled_micro_usd(model)
            delta = new_micro - current.settled_micro_usd
            self._apply_day(
                current.day, request_delta=0, reserved_delta=0, settled_delta=delta, now=now
            )
            resolved = current.model_copy(
                update={
                    "settled_micro_usd": new_micro,
                    "estimated": False,
                    "actual_input_tokens": evidence.input_tokens,
                    "actual_output_tokens": evidence.output_tokens,
                    "retries": evidence.retries,
                    "settled_at": now,
                    "updated_at": now,
                }
            )
            store.usage_reservations.replace(resolved, current.version)
            return resolved

        return store.transaction(tx)

    def _advance_run(self, run_id: str | None, now: datetime) -> None:
        """Count one committed model call against the run and stop it at the absolute cap.
        Runs inside the settle transaction, so a call is counted exactly once. A missing run
        id (e.g. a crash-recovery sweep with no run context) is a no-op."""
        store = self._d.store
        if run_id is None:
            return
        run = store.agent_runs.get(run_id)
        if run is None or run.status is not AgentRunStatus.RUNNING:
            return
        calls = run.tool_calls + 1
        update: dict[str, object] = {
            "tool_calls": calls,
            "calls_since_checkpoint": run.calls_since_checkpoint + 1,
            "updated_at": now,
        }
        if calls >= run.max_tool_calls:
            update |= {
                "status": AgentRunStatus.STOPPED,
                "stop_reason": AgentStopReason.TOOL_BUDGET,
                "ended_at": now,
            }
        store.agent_runs.replace(run.model_copy(update=update), run.version)

    def _apply_day(
        self,
        day: str,
        *,
        request_delta: int,
        reserved_delta: int,
        settled_delta: int,
        now: datetime,
    ) -> None:
        store = self._d.store
        doc = store.usage_days.get(usage_day_id(day))
        if doc is None:
            store.usage_days.insert(
                UsageDay(
                    id=usage_day_id(day),
                    day=day,
                    request_count=max(0, request_delta),
                    reserved_micro_usd=max(0, reserved_delta),
                    settled_micro_usd=max(0, settled_delta),
                    created_at=now,
                    updated_at=now,
                )
            )
            return
        store.usage_days.replace(
            doc.model_copy(
                update={
                    "request_count": max(0, doc.request_count + request_delta),
                    "reserved_micro_usd": max(0, doc.reserved_micro_usd + reserved_delta),
                    "settled_micro_usd": max(0, doc.settled_micro_usd + settled_delta),
                    "updated_at": now,
                }
            ),
            doc.version,
        )

    def _today(self) -> str:
        return self._d.clock().date().isoformat()
