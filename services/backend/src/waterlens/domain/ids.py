"""Opaque identifiers.

IDs are ``<prefix>_<26 random Crockford base32 chars>`` (130 bits of randomness). The
prefix exists for log readability and type checks at the boundary; clients must treat
the whole value as opaque and never parse it. IDs carry no timestamp, sequence or
owner information.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from enum import StrEnum

from waterlens.domain.errors import DomainError, ErrorCode

_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_BODY_LEN = 26


class IdKind(StrEnum):
    AREA = "are"
    SESSION = "ses"
    GOAL = "gol"
    SCENARIO = "scn"
    PLAN_OPTION = "pln"
    IMPACT = "imp"
    FUNDING_SCHEME = "fsc"
    FUNDING_MATCH = "fmt"
    REPORT = "rep"
    PROPOSAL = "prp"
    COMMUNITY = "com"
    MEMBERSHIP = "mem"
    PROJECT = "prj"
    MILESTONE = "mil"
    OBSERVATION = "obs"
    JOB = "job"
    OUTBOX = "obx"
    AGENT_RUN = "agr"
    ACCOUNT_CLAIM = "clm"
    INGESTION_RUN = "ing"
    CONNECTIVITY_CHECK = "cnx"
    MANUAL_INPUT = "min"


_ID_RE = re.compile(rf"^([a-z]{{3}})_[{_ALPHABET}]{{{_BODY_LEN}}}$")


def new_id(kind: IdKind) -> str:
    body = "".join(secrets.choice(_ALPHABET) for _ in range(_BODY_LEN))
    return f"{kind.value}_{body}"


def derived_id(kind: IdKind, *parts: str) -> str:
    """A deterministic ID for a record that must be unique per natural key (e.g. one
    membership per user and community), so concurrent creates collide on the same
    document instead of producing duplicates. Same format as ``new_id``; the body is a
    SHA-256 digest of the parts and cannot be reversed into them."""
    digest = hashlib.sha256("\x1f".join((kind.value, *parts)).encode()).digest()
    number = int.from_bytes(digest[:17]) >> 6  # 130 bits
    body = "".join(_ALPHABET[(number >> (5 * i)) & 31] for i in reversed(range(_BODY_LEN)))
    return f"{kind.value}_{body}"


def require_id(value: str, kind: IdKind, field: str = "id") -> str:
    """Validate an ID received from a client. A malformed or wrong-kind ID is a
    validation failure, never a lookup."""
    match = _ID_RE.fullmatch(value)
    if not match or match.group(1) != kind.value:
        raise DomainError(ErrorCode.VALIDATION_FAILED, "malformed identifier", field=field)
    return value
