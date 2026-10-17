"""Meaningful actions the agent may **prepare** but never perform (ADR 0017).

Finalizing or archiving a report, creating/archiving a community, joining/leaving one and
every tracking write are user-visible and (mostly) irreversible. The agent can assemble the
exact action from real results, but it is executed only after an explicit confirmation in
the product UI. A :class:`PreparedAction` carries everything that confirmation needs and a
``confirmation_token`` that binds it to the resource's **current version and parameters**:
if the resource changes after it is prepared, the recomputed token no longer matches, so a
stale confirmation is refused before any service is called.
"""

from __future__ import annotations

import hashlib
import json
from enum import StrEnum
from typing import Any

from pydantic import Field

from waterpilot.domain.values import Frozen

type Json = dict[str, Any]


class AgentActionKind(StrEnum):
    """The meaningful actions a tool may prepare. Each maps to one authorized service call
    performed only on explicit UI confirmation (never by the agent)."""

    FINALIZE_REPORT = "finalize_report"
    ARCHIVE_REPORT = "archive_report"
    CREATE_COMMUNITY = "create_community"
    JOIN_COMMUNITY = "join_community"
    LEAVE_COMMUNITY = "leave_community"
    ARCHIVE_COMMUNITY = "archive_community"
    START_TRACKING_PROJECT = "start_tracking_project"
    UPDATE_MILESTONE = "update_milestone"
    RECORD_OBSERVATION = "record_observation"


# Actions resolved by compare-and-set on the resource's version (so a stale confirmation is
# rejected by the service too, not only by the token). The rest are idempotent creates,
# guarded by an idempotency key supplied with the confirmation.
CAS_ACTIONS: frozenset[AgentActionKind] = frozenset(
    {
        AgentActionKind.ARCHIVE_REPORT,
        AgentActionKind.LEAVE_COMMUNITY,
        AgentActionKind.ARCHIVE_COMMUNITY,
        AgentActionKind.UPDATE_MILESTONE,
    }
)


def _canonical(value: Any) -> str:
    """A stable JSON encoding for hashing: sorted keys, no insignificant whitespace, and a
    string fallback so dates/decimals/enums encode deterministically."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def confirmation_token(
    kind: AgentActionKind,
    resource_id: str | None,
    expected_version: int | None,
    parameters: Json,
) -> str:
    """Bind an action to its resource's current version and exact parameters. Recomputed at
    confirmation time; a mismatch means the resource or the parameters changed since the
    action was prepared, so the confirmation is stale and must be refused."""
    payload = _canonical(
        {
            "kind": kind.value,
            "resourceId": resource_id,
            "expectedVersion": expected_version,
            "parameters": parameters,
        }
    )
    return hashlib.sha256(payload.encode()).hexdigest()


class PreparedAction(Frozen):
    """A meaningful action assembled from real results, awaiting explicit UI confirmation.

    It is **not** performed: ``requires_confirmation`` is always true. The UI shows ``summary``
    and, on an explicit user action, submits a :class:`ConfirmActionInput` echoing ``kind``,
    ``resource_id``, ``expected_version``, ``parameters`` and ``confirmation_token``."""

    kind: AgentActionKind
    summary: str = Field(min_length=1, max_length=500)
    resource_kind: str
    resource_id: str | None = None
    expected_version: int | None = None
    parameters: Json = Field(default_factory=dict)
    confirmation_token: str
    requires_confirmation: bool = True

    @classmethod
    def build(
        cls,
        kind: AgentActionKind,
        *,
        summary: str,
        resource_kind: str,
        resource_id: str | None,
        expected_version: int | None,
        parameters: Json,
    ) -> PreparedAction:
        return cls(
            kind=kind,
            summary=summary,
            resource_kind=resource_kind,
            resource_id=resource_id,
            expected_version=expected_version,
            parameters=parameters,
            confirmation_token=confirmation_token(kind, resource_id, expected_version, parameters),
        )

    def to_json(self) -> Json:
        """A camelCase envelope (matching the other tool results) carrying everything the UI
        needs. ``parameters`` is an **opaque echo payload**: it is submitted back verbatim in
        the :class:`ConfirmActionInput`, so its keys are left exactly as the service expects
        and are never rewritten."""
        return {
            "kind": self.kind.value,
            "summary": self.summary,
            "resourceKind": self.resource_kind,
            "resourceId": self.resource_id,
            "expectedVersion": self.expected_version,
            "parameters": self.parameters,
            "confirmationToken": self.confirmation_token,
            "requiresConfirmation": self.requires_confirmation,
        }


class ConfirmActionInput(Frozen):
    """What the product UI submits when the user confirms a :class:`PreparedAction`. The
    token and version are echoed from the prepared action; the service re-derives the token
    from the resource's current state and refuses the call if it no longer matches."""

    kind: AgentActionKind
    resource_id: str | None = None
    expected_version: int | None = None
    parameters: Json = Field(default_factory=dict)
    confirmation_token: str = Field(min_length=1)
    idempotency_key: str | None = Field(default=None, max_length=200)
    """Required for the idempotent create actions; unused by compare-and-set actions."""
