"""Deterministic AI usage policy, model metadata and reservation records (ADR 0015).

This module is pure and holds no provider SDK. It records:

- the Gemini Flash-family model metadata (id, location, capability, price, the official
  source it was read from and the date it was read), so cost estimates are reproducible and
  never invented. This records published **list prices**; it does not verify that this
  project has access, quota or an enabled model (see each ``ModelPrice.note``);
- the **proposed, configurable** usage limits (daily requests, per-run calls, retries,
  per-task output caps, timeouts, reservation TTL and a daily budget);
- exact cost arithmetic in integer **micro-USD** (1e-6 USD), half-to-even rounded, so a
  reservation is a deterministic estimate — not a billing invoice;
- the records that make a reservation **atomic**: one ``UsageReservation`` per logical
  model call (a replay returns the same record, so spending is never double-counted) and
  one ``UsageDay`` counter per UTC day (daily request count and reserved/settled totals).

Nothing here calls a model, enables billing or assumes a free tier. Prices are USD and
change over time; see ``ModelPrice.price_date`` and ``introductory_until``.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from fractions import Fraction

from pydantic import Field

from waterlens.domain.ids import IdKind, derived_id
from waterlens.domain.records import Record
from waterlens.domain.values import DecimalString, Frozen, UtcDateTime

AI_GATEWAY_VERSION = "ai-gateway-1"

MICRO_USD = 1_000_000
"""Micro-USD per USD. All budgets and costs are integer micro-USD for exact arithmetic."""


def _round_half_even(value: Fraction) -> int:
    """Round an exact amount to an integer, half to even (the money rule, conventions §4)."""
    floor = value.numerator // value.denominator
    remainder = value - floor
    half = Fraction(1, 2)
    if remainder < half:
        return floor
    if remainder > half:
        return floor + 1
    return floor if floor % 2 == 0 else floor + 1


def cost_micro_usd(tokens: int, price_per_mtok_usd: str) -> int:
    """Cost of ``tokens`` at a USD price per 1,000,000 tokens, in micro-USD.

    ``tokens / 1e6 * price_usd * 1e6 == tokens * price_usd`` (micro-USD), computed exactly
    and rounded half to even. Never negative."""
    if tokens < 0:
        raise ValueError("token counts cannot be negative")
    return _round_half_even(Fraction(tokens) * Fraction(Decimal(price_per_mtok_usd)))


# --------------------------------------------------------------------------- models

# Official sources the figures below were read from. These are the canonical Google Cloud
# pages; the exact figures were read on ``PRICE_DATE``. They document published list prices
# only — they are NOT a statement that this project has access, a quota, or an enabled
# model. Project access is unverified (see each ``ModelPrice.note``).
VERTEX_PRICING_URL = "https://cloud.google.com/vertex-ai/generative-ai/pricing"
"""Vertex AI generative-AI pricing (per-token input/output/cached/embedding list prices)."""
GEMINI_MODELS_DOC_URL = "https://cloud.google.com/vertex-ai/generative-ai/docs/models"
"""Vertex AI model reference (capabilities, context window, availability by region)."""

# All configured models bill the same way: metered, per-token pay-as-you-go on the public
# list price. No provisioned throughput (PTU) reservation, no committed-use discount and no
# permanent free tier are assumed or configured.
PRICING_MODE = "pay-as-you-go, metered per token (no provisioned throughput, no free tier)"


class ModelPrice(Frozen):
    """USD list price per 1,000,000 tokens, read from ``source_url`` on ``price_date``.

    Token categories priced here (the categories the provider meters and bills separately):

    - ``input_per_mtok`` — prompt / input tokens charged at the standard (uncached) rate;
    - ``output_per_mtok`` — response tokens, **including reasoning/thinking tokens**, which
      the provider bills together as output;
    - ``cached_input_per_mtok`` — input tokens served from context cache (a reduced rate);
    - ``embedding_per_mtok`` — embedding tokens (used only if an embedding call is made).

    ``pricing_mode`` records how the model is billed (metered pay-as-you-go, not provisioned
    throughput). Prices are public list prices, not a free tier, and can change over time."""

    input_per_mtok: DecimalString
    output_per_mtok: DecimalString
    cached_input_per_mtok: DecimalString
    embedding_per_mtok: DecimalString
    price_date: str
    note: str
    source_url: str = VERTEX_PRICING_URL
    """Official Google Cloud page the figures were read from (list price, not an access
    guarantee)."""
    pricing_mode: str = PRICING_MODE
    introductory_until: str | None = None
    """ISO date after which the recorded price is superseded by standard pricing, if the
    recorded price is a time-limited introductory rate; otherwise None."""


class ModelInfo(Frozen):
    model_id: str
    location: str
    capability: str
    restricted_for_new_projects: bool = False
    price: ModelPrice


PRICE_DATE = "2026-10-12"
"""The date the Vertex AI generative-AI pricing page was read for the figures below."""

# Default pinned model. gemini-2.5-flash has stable (non-introductory) Vertex pricing and
# is the model used in the official google-genai Vertex example. The model list marks it
# "restricted for new projects", so the owner may need to enable it or pick a 3.x Flash
# (see GEMINI_3_8_FLASH) via WL_AI_MODEL — an explicit owner setup choice, not a default
# that silently spends.
GEMINI_2_5_FLASH = ModelInfo(
    model_id="gemini-2.5-flash",
    location="global",
    capability=(
        "text in/out, image and video input, deterministic structured JSON output "
        "(responseSchema) and function calling, ~1M-token input context; the output "
        "price includes reasoning/thinking tokens"
    ),
    restricted_for_new_projects=True,
    price=ModelPrice(
        input_per_mtok="0.30",
        output_per_mtok="2.50",
        cached_input_per_mtok="0.03",
        embedding_per_mtok="0.15",
        price_date=PRICE_DATE,
        note=(
            "Vertex AI standard global list pricing (not introductory, no permanent free "
            "tier), read from the Vertex AI generative-AI pricing page; capability from the "
            "Vertex AI model reference. Project access, quota and model enablement are "
            "UNVERIFIED — confirm them before any live call."
        ),
    ),
)

# Current latest Flash for a brand-new project. Introductory global pricing applies only
# through 2026-12-31; standard pricing ($1.50 in / $7.50 out per 1M) applies from
# 2027-01-01. Recorded so the owner can choose it; selecting it is an owner setup choice.
GEMINI_3_8_FLASH = ModelInfo(
    model_id="gemini-3.8-flash",
    location="global",
    capability=(
        "latest Flash family: text in/out, image/video/audio input, structured JSON "
        "output and function calling; the output price includes reasoning/thinking tokens"
    ),
    price=ModelPrice(
        input_per_mtok="0.75",
        output_per_mtok="3.75",
        cached_input_per_mtok="0.075",
        embedding_per_mtok="0.15",
        price_date=PRICE_DATE,
        note=(
            "Vertex AI introductory GLOBAL list pricing through 2026-12-31; from 2027-01-01 "
            "the standard rate is $1.50 input / $7.50 output per 1M tokens. Non-global "
            "regions cost more. Not a free tier. Read from the Vertex AI generative-AI "
            "pricing page; capability from the Vertex AI model reference. Project access, "
            "quota and model enablement are UNVERIFIED — confirm them before any live call."
        ),
        introductory_until="2026-12-31",
    ),
)

MODEL_CATALOGUE: dict[str, ModelInfo] = {
    GEMINI_2_5_FLASH.model_id: GEMINI_2_5_FLASH,
    GEMINI_3_8_FLASH.model_id: GEMINI_3_8_FLASH,
}

DEFAULT_MODEL_ID = GEMINI_2_5_FLASH.model_id

# The server-side Python SDK for both Vertex AI and the Developer API. It is a declared
# **runtime** dependency (``pyproject.toml``): the deployed agent runtime constructs the ADK
# gateway LLM bridge, which imports it directly, and ADK itself requires it. It is pinned to
# the ADK-compatible range (``>=2.29,<3``; ADK 2.11.0 requires ``>=2.19,<3``). The Vertex
# adapter still imports it lazily so a model object is built only when a live call is wired.
AI_SDK_PACKAGE = "google-genai"
AI_SDK_MIN_VERSION = "2.19"
AI_SDK_IMPORT = "from google import genai"


def model_info(model_id: str) -> ModelInfo | None:
    return MODEL_CATALOGUE.get(model_id)


# --------------------------------------------------------------------------- tasks


class ModelTask(StrEnum):
    """What a model call is for. Each task has an output cap appropriate to it, so a call
    reserves and is allowed only what that task needs."""

    GOAL_INTERPRETATION = "goal_interpretation"
    SCENARIO_INTERPRETATION = "scenario_interpretation"
    OPTION_EXPLANATION = "option_explanation"
    IMPACT_SUMMARY = "impact_summary"
    PROPOSAL_NARRATIVE = "proposal_narrative"
    EMBEDDING_QUERY = "embedding_query"
    EMBEDDING_DOCUMENT = "embedding_document"


TASK_OUTPUT_LIMIT: dict[ModelTask, int] = {
    ModelTask.EMBEDDING_QUERY: 0,
    ModelTask.EMBEDDING_DOCUMENT: 0,
    ModelTask.GOAL_INTERPRETATION: 512,
    ModelTask.SCENARIO_INTERPRETATION: 512,
    ModelTask.OPTION_EXPLANATION: 1024,
    ModelTask.IMPACT_SUMMARY: 1024,
    ModelTask.PROPOSAL_NARRATIVE: 2048,
}


# --------------------------------------------------------------------------- limits

SUGGESTED_DAILY_BUDGET_USD = "5"
"""A suggested internal AI allowance. It is a configuration *suggestion*: the owner must
set ``WL_AI_DAILY_BUDGET_USD`` explicitly to enable spending. It is never a default."""


@dataclass(frozen=True, slots=True)
class AiLimits:
    """Proposed, configurable bounds. Every value is overridable from settings."""

    daily_request_limit: int = 100
    """Model requests per project per day (proposed)."""
    max_active_runs_per_session: int = 1
    max_calls_per_run: int = 5
    """Model calls in one run before a user-visible Continue checkpoint is required."""
    hard_calls_per_run: int = 20
    """Absolute cap on model calls in one run, regardless of Continue checkpoints."""
    transient_retries: int = 2
    """Retries after a transient error (so at most ``transient_retries + 1`` attempts)."""
    max_input_tokens: int = 48_000
    default_max_output_tokens: int = 1024
    request_timeout_seconds: float = 30.0
    reservation_ttl_seconds: int = 300
    run_ttl_seconds: int = 3600
    """Wall-clock lifetime of one agent run. After it, no tool step or model call may run,
    enforced from the run's own ``expires_at`` independently of any TTL cleanup."""
    max_tool_steps_per_run: int = 40
    """Absolute cap on committed agent tool steps in one run (bounds tool counts and loops)."""
    max_tool_fanout: int = 8
    """Most tool calls one model turn may request at once (bounds fan-out)."""
    max_tool_repeats: int = 3
    """Most times the same tool may be called with identical arguments in one run (bounds
    loops where the model repeats a call without making progress)."""
    daily_budget_micro_usd: int | None = None
    """Daily spend ceiling in micro-USD. ``None`` means no budget is configured, so the
    gateway treats AI as disabled (no spending without an explicit owner choice)."""

    def output_limit(self, task: ModelTask, requested: int | None) -> int:
        cap = TASK_OUTPUT_LIMIT.get(task, self.default_max_output_tokens)
        return min(requested, cap) if requested is not None and requested > 0 else cap

    @staticmethod
    def budget_micro_from_usd(usd: str | None) -> int | None:
        if usd is None:
            return None
        return _round_half_even(Fraction(Decimal(usd)) * MICRO_USD)


# --------------------------------------------------------------------------- usage


class UsageEstimate(Frozen):
    """A worst-case cost estimate for one logical call, reserved before dispatch so concurrent
    calls cannot overspend the budget.

    The worst case covers **every permitted dispatched attempt**: ``max_attempts`` is the
    initial attempt plus the allowed transient retries, and each attempt re-sends the full
    input and may emit up to ``max_output_tokens`` (which the provider bills as output,
    including reasoning/thinking tokens). So the reservation is ``max_attempts`` times the
    per-attempt input-plus-full-output cost — a retried call can never exceed its hold."""

    model_id: str
    task: ModelTask
    input_tokens: int = Field(ge=0)
    max_output_tokens: int = Field(ge=0)
    max_attempts: int = Field(default=1, ge=1)
    """Permitted dispatched attempts (initial attempt + transient retries). Each attempt is
    billable, so the reservation covers all of them."""

    def per_attempt_micro_usd(self, info: ModelInfo) -> int:
        """Worst-case cost of a single dispatched attempt: full input + full reserved output."""
        return cost_micro_usd(self.input_tokens, info.price.input_per_mtok) + cost_micro_usd(
            self.max_output_tokens, info.price.output_per_mtok
        )

    def reserved_micro_usd(self, info: ModelInfo) -> int:
        """Worst case over all permitted attempts: ``max_attempts`` per-attempt charges."""
        return self.per_attempt_micro_usd(info) * self.max_attempts

    def reserved_tokens(self) -> int:
        """Worst-case total tokens held across all permitted attempts (informational)."""
        return (self.input_tokens + self.max_output_tokens) * self.max_attempts


class UsageActual(Frozen):
    """Reported usage after a call, reconciled against the reservation. ``output_tokens``
    already includes any reasoning/thinking tokens, which the provider bills as output;
    ``thinking_tokens`` is the informational subset. Token counts are summed across every
    billable attempt (so a retried, billable attempt is counted)."""

    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    thinking_tokens: int = Field(default=0, ge=0)
    cached_input_tokens: int = Field(default=0, ge=0)
    embedding_tokens: int = Field(default=0, ge=0)
    retries: int = Field(default=0, ge=0)

    def settled_micro_usd(self, info: ModelInfo) -> int:
        non_cached = max(0, self.input_tokens - self.cached_input_tokens)
        return (
            cost_micro_usd(non_cached, info.price.input_per_mtok)
            + cost_micro_usd(self.cached_input_tokens, info.price.cached_input_per_mtok)
            + cost_micro_usd(self.output_tokens, info.price.output_per_mtok)
            + cost_micro_usd(self.embedding_tokens, info.price.embedding_per_mtok)
        )


# --------------------------------------------------------------------------- records


class ReservationStatus(StrEnum):
    RESERVED = "reserved"
    SETTLED = "settled"
    RELEASED = "released"


RESERVATION_RETENTION = timedelta(days=7)
"""How long a settled or released reservation is kept before storage may delete it."""


class UsageReservation(Record):
    """One logical model call's spending hold. Its id is derived from the caller's call
    key, so replaying a reserve collides on the same document instead of double-counting.

    ``due_at`` is the reconciliation time while the hold is ``RESERVED`` (its expiry): if a
    crash leaves a hold that never settled, reconciliation releases it once ``due_at`` has
    passed. It is cleared once the reservation is settled or released, so a finished
    reservation is never reconciled again (mirrors the job/outbox ``due_at`` rule)."""

    owner_uid: str
    day: str = Field(min_length=10, max_length=10)
    model_id: str
    task: ModelTask
    run_id: str | None = None
    status: ReservationStatus = ReservationStatus.RESERVED
    reserved_micro_usd: int = Field(ge=0)
    reserved_tokens: int = Field(ge=0)
    settled_micro_usd: int = Field(default=0, ge=0)
    actual_input_tokens: int = Field(default=0, ge=0)
    actual_output_tokens: int = Field(default=0, ge=0)
    retries: int = Field(default=0, ge=0)
    dispatched: bool = False
    """True once a request for this hold was handed to the provider. It is persisted
    **before** the provider call, so a hold left ``RESERVED`` by a crash can be judged from
    its record alone: ``dispatched=False`` proves no request was ever sent (safe to release,
    nothing billed), while ``dispatched=True`` means the outcome is unknown and billable
    usage may have occurred (settle conservatively, never release, never replay)."""
    estimated: bool = False
    """True when settled at the reserved worst-case estimate rather than the provider's
    reported usage: a call that was dispatched but whose outcome is ambiguous (timeout,
    cancellation after dispatch, or transient errors that exhausted the retry budget). Such
    a call may have incurred billable usage, so the hold is settled conservatively (never
    released, never replayed) and left for later reconciliation against real usage. An
    estimate is **unresolved**: reconciliation against evidenced actuals may **raise or
    lower** it, so retention keeps the record until it is reconciled (``estimated`` cleared)."""
    due_at: UtcDateTime | None = None
    settled_at: UtcDateTime | None = None


class UsageDay(Record):
    """Project-wide daily counter (one document per UTC day). ``committed`` spending is the
    reserved holds plus the settled charges; the budget check compares it to the ceiling.

    One document per day serializes the day's writes under contention. At the proposed 100
    requests/day this needs no sharding; sharded counters (ADR 0005) are the scale
    follow-up, exactly as for the community member counter."""

    day: str = Field(min_length=10, max_length=10)
    request_count: int = Field(default=0, ge=0)
    reserved_micro_usd: int = Field(default=0, ge=0)
    settled_micro_usd: int = Field(default=0, ge=0)

    @property
    def committed_micro_usd(self) -> int:
        return self.reserved_micro_usd + self.settled_micro_usd


CALL_KEY_RETENTION = timedelta(days=30)
"""How long a durable call-key tombstone is kept — the paid-call deduplication window.

It is deliberately **longer than** ``RESERVATION_RETENTION`` (7 days) and at least as long as
the conversation idle TTL (30 days), so the tombstone outlives both the detailed reservation
record (which may be cleaned up for reconciliation hygiene) and any conversation that could
replay the call. Within this window a replayed ``call_key`` is refused even after its
reservation is gone, so deduplication never depends on retained conversation events."""


class UsageCallKey(Record):
    """A durable, minimal **tombstone** that a paid-call key reached a terminal outcome
    (settled or released). It is written in the same transaction that resolves the hold, and
    its document id is the reservation id (both derive from the same ``call_key``), so the
    gateway can look it up without the original key.

    It exists so paid-call deduplication is independent of two things that are intentionally
    not permanent: the detailed ``UsageReservation`` record (7-day retention) and the
    bounded, trimmed conversation events. A replay of the same ``call_key`` is refused while
    this tombstone exists — the window is ``CALL_KEY_RETENTION`` — regardless of whether the
    reservation record or any conversation event still exists."""

    outcome: ReservationStatus


def call_key_expires_at(record: UsageCallKey) -> datetime:
    """When storage may delete a call-key tombstone: ``CALL_KEY_RETENTION`` after it was
    written. A deletion hint only (Firestore TTL); no read or query depends on it."""
    return record.created_at + CALL_KEY_RETENTION


def call_key_tombstone_id(reservation_id: str) -> str:
    """The tombstone shares the reservation's document id (same ``call_key`` derivation), so
    it lives in its own collection without re-deriving from the key."""
    return reservation_id


def reservation_expires_at(record: UsageReservation):  # type: ignore[no-untyped-def]
    """When storage may delete a reservation: ``RESERVATION_RETENTION`` after it settled or
    was released. ``None`` (never auto-delete) while the record is still needed:

    - a live ``RESERVED`` hold, so it is never deleted before reconciliation can resolve it;
    - a ``SETTLED`` hold still flagged ``estimated`` — an **unresolved** conservative estimate
      awaiting reconciliation, and still the idempotency guard for its ``call_key``.

    Only a resolved record (a clean settle, a reconciled estimate, or a release) gets the TTL.
    This is only a deletion hint; no read or query depends on it."""
    if record.status is ReservationStatus.RESERVED:
        return None
    if record.status is ReservationStatus.SETTLED and record.estimated:
        return None
    return (record.settled_at or record.updated_at) + RESERVATION_RETENTION


def reservation_id_for(call_key: str) -> str:
    return derived_id(IdKind.USAGE_RESERVATION, call_key)


def usage_day_id(day: str) -> str:
    return derived_id(IdKind.USAGE_DAY, day)


# --------------------------------------------------------------------------- status


class AiUnavailableReason(StrEnum):
    DISABLED = "disabled"
    """AI is off: the server kill switch is on, or AI is not enabled/configured."""
    NOT_INVITED = "not_invited"
    """AI access is limited to invited testers and this account is not one."""
    BUDGET_EXHAUSTED = "budget_exhausted"
    """The daily request count or spend ceiling is reached; try again tomorrow."""
    NO_BUDGET_CONFIGURED = "no_budget_configured"
    """No daily budget is set, so no spending is permitted without an owner choice."""


@dataclass(frozen=True, slots=True)
class AiStatus:
    """What the UI needs to decide whether to offer AI and, if not, to explain why. Ordinary
    planning never depends on this; it is advisory only."""

    available: bool
    reason: AiUnavailableReason | None
    model_id: str
    requests_remaining: int
    daily_request_limit: int
    budget_configured: bool
    suggested_daily_budget_usd: str = SUGGESTED_DAILY_BUDGET_USD

    def with_reason(self, reason: AiUnavailableReason) -> AiStatus:
        return replace(self, available=False, reason=reason)
