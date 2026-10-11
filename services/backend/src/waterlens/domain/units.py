"""Reviewed, exact unit normalization (conventions §1).

A raw unit is recorded verbatim as published. It normalizes to a canonical unit only
through an entry in ``REVIEWED_CONVERSIONS``; every factor is an exact rational, so a
conversion never introduces floating-point error. A raw unit without an entry is kept,
not rejected: its variable stays un-normalized and cannot pass readiness criterion 3.
Lookups are case-sensitive on purpose ("ML" is a megalitre, "mL" a millilitre).
"""

from __future__ import annotations

from decimal import Decimal, localcontext
from enum import StrEnum
from fractions import Fraction


class CanonicalUnit(StrEnum):
    """Mirrors ``normalizedUnit`` in ``docs/domain/source-manifest.schema.json``."""

    LITRE = "L"
    LITRES_PER_DAY = "L/day"
    MILLIMETRE = "mm"
    METRES_BELOW_GROUND = "m_bgl"
    SQUARE_METRE = "m2"
    RATIO = "ratio"
    DAY = "day"
    INR_PAISE = "INR_paise"
    COUNT = "count"
    CATEGORY = "category"
    MG_PER_LITRE = "mg/L"
    NTU = "NTU"
    MICROSIEMENS_PER_CM = "uS/cm"
    PH = "pH"
    CFU_PER_100ML = "CFU/100mL"


_MEGA = Fraction(1_000_000)
_THOUSANDTH = Fraction(1, 1000)

REVIEWED_CONVERSIONS: dict[CanonicalUnit, dict[str, Fraction]] = {
    CanonicalUnit.LITRE: {
        "L": Fraction(1),
        "l": Fraction(1),
        "kL": Fraction(1000),
        "m3": Fraction(1000),
        "m³": Fraction(1000),
        "ML": _MEGA,
    },
    CanonicalUnit.LITRES_PER_DAY: {
        "L/day": Fraction(1),
        "L/d": Fraction(1),
        "kL/day": Fraction(1000),
        "m3/day": Fraction(1000),
        "m³/day": Fraction(1000),
        "MLD": _MEGA,
        "ML/day": _MEGA,
        "L/s": Fraction(86_400),
    },
    CanonicalUnit.MILLIMETRE: {"mm": Fraction(1), "cm": Fraction(10), "m": Fraction(1000)},
    # A bare "m" is ambiguous for groundwater (below ground vs above datum), so only an
    # explicit below-ground declaration normalizes.
    CanonicalUnit.METRES_BELOW_GROUND: {
        "m_bgl": Fraction(1),
        "m bgl": Fraction(1),
        "mbgl": Fraction(1),
    },
    CanonicalUnit.SQUARE_METRE: {
        "m2": Fraction(1),
        "m²": Fraction(1),
        "ha": Fraction(10_000),
        "km2": _MEGA,
        "km²": _MEGA,
    },
    CanonicalUnit.RATIO: {"ratio": Fraction(1), "%": Fraction(1, 100)},
    CanonicalUnit.DAY: {"day": Fraction(1), "days": Fraction(1)},
    CanonicalUnit.INR_PAISE: {"INR_paise": Fraction(1), "paise": Fraction(1), "INR": Fraction(100)},
    CanonicalUnit.COUNT: {"count": Fraction(1), "people": Fraction(1), "persons": Fraction(1)},
    CanonicalUnit.MG_PER_LITRE: {
        "mg/L": Fraction(1),
        "mg/l": Fraction(1),
        "µg/L": _THOUSANDTH,
        "μg/L": _THOUSANDTH,
        "ug/L": _THOUSANDTH,
    },
    CanonicalUnit.NTU: {"NTU": Fraction(1)},
    CanonicalUnit.MICROSIEMENS_PER_CM: {
        "uS/cm": Fraction(1),
        "µS/cm": Fraction(1),
        "μS/cm": Fraction(1),
        "mS/cm": Fraction(1000),
    },
    CanonicalUnit.PH: {"pH": Fraction(1)},
    # MPN is a different method, not a unit of CFU: no conversion is offered.
    CanonicalUnit.CFU_PER_100ML: {"CFU/100mL": Fraction(1), "CFU/100 mL": Fraction(1)},
}

CATEGORY_RAW_UNITS = frozenset({"category", "class", "class code"})
"""Categorical codes are labels: they normalize to ``category`` without arithmetic."""


class UnitConversionError(ValueError):
    pass


def _clean(raw_unit: str) -> str:
    return " ".join(raw_unit.split())


def conversion_factor(raw_unit: str, canonical: CanonicalUnit) -> Fraction | None:
    """The exact factor from ``raw_unit`` to ``canonical``, or ``None`` if unreviewed."""
    return REVIEWED_CONVERSIONS.get(canonical, {}).get(_clean(raw_unit))


def is_normalizable(raw_unit: str, canonical: CanonicalUnit) -> bool:
    if canonical is CanonicalUnit.CATEGORY:
        return _clean(raw_unit) in CATEGORY_RAW_UNITS
    return conversion_factor(raw_unit, canonical) is not None


def exact_decimal(value: Fraction) -> Decimal:
    """``value`` as a Decimal, refusing any result that would need rounding."""
    with localcontext() as ctx:
        ctx.prec = 60
        result = Decimal(value.numerator) / Decimal(value.denominator)
    if Fraction(result) != value:
        raise UnitConversionError("conversion result is not an exact decimal")
    return result


def normalize(value: Decimal, raw_unit: str, canonical: CanonicalUnit) -> Decimal:
    """Convert a raw numeric value exactly. Raises ``UnitConversionError`` for an
    unreviewed unit pair, a categorical target or a non-finite value."""
    if not value.is_finite():
        raise UnitConversionError("value must be a finite number")
    factor = conversion_factor(raw_unit, canonical)
    if factor is None:
        raise UnitConversionError(f"no reviewed conversion from {raw_unit!r} to {canonical}")
    return exact_decimal(Fraction(value) * factor)


def render(value: Decimal) -> str:
    """Canonical decimal string: no exponent, no trailing fractional zeros."""
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if text in {"-0", ""} else text
