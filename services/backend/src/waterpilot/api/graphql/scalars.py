"""Custom scalars. Exact numbers travel as strings so no client ever parses them into
binary floating point or overflows 32-bit GraphQL ``Int``.

The ``NewType``s are the Python-side types; ``SCALAR_OVERRIDES`` maps them to their
GraphQL definitions when the schema is built.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import NewType

import strawberry

from waterpilot.domain.values import utc_iso

UtcDateTime = NewType("UtcDateTime", datetime)
LocalDate = NewType("LocalDate", date)
DecimalString = NewType("DecimalString", str)
MinorUnits = NewType("MinorUnits", str)


def _parse_instant(value: object) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamps must include a UTC offset")
    return parsed


SCALAR_OVERRIDES: dict[object, object] = {
    UtcDateTime: strawberry.scalar(
        name="UtcDateTime",
        description="An instant in UTC, ISO-8601 with a 'Z' suffix (e.g. 2026-10-07T18:30:00Z).",
        serialize=utc_iso,
        parse_value=_parse_instant,
    ),
    LocalDate: strawberry.scalar(
        name="LocalDate",
        description="A calendar date (YYYY-MM-DD) in the relevant area's IANA timezone.",
        serialize=lambda v: v.isoformat(),
        parse_value=lambda v: date.fromisoformat(str(v)),
    ),
    DecimalString: strawberry.scalar(
        name="DecimalString",
        description="An exact decimal number as a string (e.g. '1250000.5'). Parse with a "
        "decimal library, never as a binary float.",
        serialize=str,
        parse_value=str,
    ),
    MinorUnits: strawberry.scalar(
        name="MinorUnits",
        description="An integer amount of a currency's minor unit (e.g. paise for INR) as a "
        "string, to avoid 32-bit/53-bit integer limits.",
        serialize=str,
        parse_value=str,
    ),
}
