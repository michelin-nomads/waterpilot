"""Bounded cursor pagination.

Lists are ordered newest first by ``(sort_key desc, id desc)``. Cursors are opaque
base64url tokens that also bind the filter they were issued for, so a cursor cannot
be replayed against a different filter. No list is unbounded: ``first`` is 1..50.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass

from waterlens.domain.errors import DomainError, ErrorCode

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50

type FilterValue = str | bool | None


@dataclass(frozen=True, slots=True)
class Position:
    sort_key: str
    id: str


@dataclass(frozen=True, slots=True)
class PageQuery:
    first: int
    after: Position | None
    filter_hash: str


@dataclass(frozen=True, slots=True)
class PageArgs:
    """Raw client arguments; services bind them to their filter with ``page_query``."""

    first: int | None = None
    after: str | None = None

    def bind(self, where: Mapping[str, FilterValue]) -> PageQuery:
        return page_query(self.first, self.after, where)


@dataclass(frozen=True, slots=True)
class Page[T]:
    items: tuple[T, ...]
    has_next_page: bool
    end_cursor: str | None


def filter_fingerprint(where: Mapping[str, FilterValue]) -> str:
    canonical = json.dumps(dict(sorted(where.items())), separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def encode_cursor(position: Position, filter_hash: str) -> str:
    raw = json.dumps({"k": position.sort_key, "i": position.id, "f": filter_hash})
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def _invalid_cursor() -> DomainError:
    return DomainError(ErrorCode.VALIDATION_FAILED, "invalid pagination cursor", field="after")


def page_query(first: int | None, after: str | None, where: Mapping[str, FilterValue]) -> PageQuery:
    size = DEFAULT_PAGE_SIZE if first is None else first
    if not 1 <= size <= MAX_PAGE_SIZE:
        raise DomainError(
            ErrorCode.VALIDATION_FAILED,
            f"first must be between 1 and {MAX_PAGE_SIZE}",
            field="first",
        )
    fingerprint = filter_fingerprint(where)
    if after is None:
        return PageQuery(size, None, fingerprint)
    if len(after) > 512:
        raise _invalid_cursor()
    try:
        padded = after + "=" * (-len(after) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        raise _invalid_cursor() from None
    if (
        not isinstance(data, dict)
        or not isinstance(data.get("k"), str)
        or not isinstance(data.get("i"), str)
        or data.get("f") != fingerprint
    ):
        raise _invalid_cursor()
    return PageQuery(size, Position(data["k"], data["i"]), fingerprint)


def paginate[T](
    items: Iterable[T], position_of: Callable[[T], Position], query: PageQuery
) -> Page[T]:
    """Reference implementation over already-filtered items (used by local adapters;
    the Firestore adapter maps the same contract onto ``order_by``/``start_after``)."""
    ordered = sorted(
        items, key=lambda item: (position_of(item).sort_key, position_of(item).id), reverse=True
    )
    if query.after is not None:
        marker = (query.after.sort_key, query.after.id)
        ordered = [i for i in ordered if (position_of(i).sort_key, position_of(i).id) < marker]
    window = ordered[: query.first + 1]
    has_next = len(window) > query.first
    window = window[: query.first]
    end = encode_cursor(position_of(window[-1]), query.filter_hash) if window else None
    return Page(tuple(window), has_next, end)
