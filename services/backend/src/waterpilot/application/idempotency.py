"""Idempotent create operations.

A key is scoped to ``(verified uid, operation)``. Replaying the same key with the
same input returns the original result ids; reusing it with different input fails
with ``IDEMPOTENCY_KEY_REUSED`` instead of silently creating or returning something
else. Records are retained at least 24 hours (Firestore TTL in the cloud adapter).
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable
from datetime import datetime

from pydantic import BaseModel

from waterpilot.application.repositories import IdempotencyRecord, Store
from waterpilot.domain.errors import DomainError, ErrorCode

_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")


def fingerprint(payload: BaseModel) -> str:
    canonical = json.dumps(payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def require_key(key: str) -> str:
    if not _KEY_RE.fullmatch(key):
        raise DomainError(
            ErrorCode.VALIDATION_FAILED,
            "idempotencyKey must be 16-128 characters of A-Z, a-z, 0-9, '_' or '-'",
            field="idempotencyKey",
        )
    return key


def run_once(
    store: Store,
    *,
    uid: str,
    operation: str,
    key: str,
    payload: BaseModel,
    now: datetime,
    create: Callable[[], tuple[str, ...]],
) -> tuple[str, ...]:
    """Run ``create`` at most once per key. Must be called inside ``store.transaction``."""
    require_key(key)
    digest = fingerprint(payload)
    existing = store.idempotency.get(uid, operation, key)
    if existing is not None:
        if existing.fingerprint != digest:
            raise DomainError(
                ErrorCode.IDEMPOTENCY_KEY_REUSED,
                "this idempotency key was already used for a different request",
                field="idempotencyKey",
            )
        return existing.result_ids
    result_ids = create()
    store.idempotency.put(
        IdempotencyRecord(
            uid=uid,
            operation=operation,
            key=key,
            fingerprint=digest,
            result_ids=result_ids,
            created_at=now,
        )
    )
    return result_ids
