"""Locations people choose, and the region settings derived from them (ADR 0009).

A place name or a point is **not** a catchment. A location carries its provider place
id, country, coordinates, administrative context and *geographic scope* (what kind of
place it is). Coverage checks use an *extent*: a reviewed boundary (catalogue areas
only), a radius the person sets (labelled user-defined) or the reference point alone.
Neighbourhood boundaries are never fabricated from a place name or a provider viewport.

Region settings (currency, timezone, unit system) belong to the location and are kept
apart from the interface language.
"""

from __future__ import annotations

import math
import re
from collections.abc import Mapping, Sequence
from enum import StrEnum
from functools import cache
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones

from babel import Locale
from babel.core import get_global
from babel.numbers import get_territory_currencies, list_currencies
from pydantic import Field

from waterlens.domain.values import DecimalString, Frozen

Longitude = Annotated[float, Field(ge=-180, le=180)]
Latitude = Annotated[float, Field(ge=-90, le=90)]
BBox = tuple[Longitude, Latitude, Longitude, Latitude]

PLACE_ID = re.compile(r"^(google|fixture):[A-Za-z0-9_\-]{1,300}$")
"""Provider-prefixed place id. Place ids may be stored indefinitely under the provider's
terms; other provider content (names, coordinates) expires (``PROVIDER_CONTENT_DAYS``)."""

PROVIDER_CONTENT_DAYS = 30
"""Google Maps Platform terms allow caching place coordinates for up to 30 days (ADR 0009;
the owner must confirm against the current terms). After that the location is stale
until it is chosen again."""

MIN_RADIUS_M = 100
MAX_RADIUS_M = 50_000
INACCURATE_FIX_M = 1_000
"""A device fix less precise than this is shown as approximate and must be confirmed."""


class AreaOrigin(StrEnum):
    CATALOGUE = "catalogue"
    """Reviewed reference area with a confirmed boundary (or the synthetic demo area)."""
    PLACE_SEARCH = "place_search"
    GEOLOCATION = "geolocation"
    CUSTOM = "custom"


PRIVATE_ORIGINS = frozenset({AreaOrigin.GEOLOCATION, AreaOrigin.CUSTOM})
"""Device and typed-in locations can reveal where someone lives: owner-only."""


class GeographicScope(StrEnum):
    COUNTRY = "country"
    REGION = "region"
    LOCALITY = "locality"
    SUBLOCALITY = "sublocality"
    NEIGHBOURHOOD = "neighbourhood"
    POSTAL_CODE = "postal_code"
    POINT = "point"


_SCOPE_BY_TYPE: tuple[tuple[str, GeographicScope], ...] = (
    ("country", GeographicScope.COUNTRY),
    ("administrative_area_level_1", GeographicScope.REGION),
    ("administrative_area_level_2", GeographicScope.REGION),
    ("administrative_area_level_3", GeographicScope.REGION),
    ("locality", GeographicScope.LOCALITY),
    ("postal_town", GeographicScope.LOCALITY),
    ("sublocality", GeographicScope.SUBLOCALITY),
    ("sublocality_level_1", GeographicScope.SUBLOCALITY),
    ("neighborhood", GeographicScope.NEIGHBOURHOOD),
    ("postal_code", GeographicScope.POSTAL_CODE),
)


def scope_from_types(types: tuple[str, ...]) -> GeographicScope:
    """The broadest administrative kind a provider reports; anything else (an address,
    a building, a business) is a point."""
    present = set(types)
    for kind, scope in _SCOPE_BY_TYPE:
        if kind in present:
            return scope
    return GeographicScope.POINT


class ExtentKind(StrEnum):
    REVIEWED_BOUNDARY = "reviewed_boundary"
    USER_RADIUS = "user_radius"
    REFERENCE_POINT = "reference_point"


class UnitSystem(StrEnum):
    METRIC = "metric"
    US_CUSTOMARY = "us_customary"


_US_CUSTOMARY = frozenset({"US", "LR", "MM"})
"""CLDR measurementData: territories using the US system; all others are metric."""

_NOT_COUNTRIES = frozenset({"EU", "EZ", "UN", "ZZ", "QO", "XA", "XB"})


@cache
def country_names() -> dict[str, str]:
    """ISO 3166-1 alpha-2 codes (plus CLDR's XK) with English names, from CLDR."""
    territories = Locale("en").territories
    return dict(
        sorted(
            (
                (code, name)
                for code, name in territories.items()
                if len(code) == 2 and code.isalpha() and code not in _NOT_COUNTRIES
            ),
            key=lambda item: item[1],
        )
    )


def unit_system_for(country_code: str) -> UnitSystem:
    return UnitSystem.US_CUSTOMARY if country_code in _US_CUSTOMARY else UnitSystem.METRIC


def currency_for(country_code: str) -> str | None:
    """The current legal tender per CLDR, or ``None`` where CLDR lists none (e.g. AQ)."""
    currencies = get_territory_currencies(country_code, tender=True, non_tender=False)
    return currencies[0] if currencies else None


def timezone_at(lat: float, lon: float) -> str:
    """IANA timezone at a point (tzfpy, timezone-boundary-builder data); ocean points get
    the nautical ``Etc/GMT±N`` zone. Falls back to UTC only if the zone is unknown to this
    system's tz database."""
    import tzfpy

    zone = str(tzfpy.get_tz(lon, lat))
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        return "UTC"
    return zone


def currency_options(country_code: str) -> tuple[str, ...]:
    """Every current legal tender CLDR lists for the territory, in CLDR order."""
    return tuple(get_territory_currencies(country_code, tender=True, non_tender=False))


def timezone_options(country_code: str) -> tuple[str, ...]:
    """The territory's IANA zones per CLDR that this system's tz database knows."""
    zones: Mapping[str, Sequence[str]] = get_global("territory_zones")
    known = available_timezones()
    return tuple(sorted(z for z in zones.get(country_code, ()) if z in known))


def is_timezone(zone: str) -> bool:
    return zone in available_timezones()


def is_currency(code: str) -> bool:
    return re.fullmatch(r"[A-Z]{3}", code) is not None and code in list_currencies()


class RegionSettings(Frozen):
    """Region settings inferred for a point in a country, with how sure the inference
    is. Uncertain values must be shown for the person to check before confirming."""

    currency: str | None
    currency_options: tuple[str, ...]
    currency_certain: bool
    timezone: str
    timezone_options: tuple[str, ...]
    timezone_certain: bool
    unit_system: UnitSystem


def region_settings(lat: float, lon: float, country_code: str) -> RegionSettings:
    """Currency: certain only when CLDR lists exactly one tender. Time zone: certain only
    when the zone at the point belongs to the chosen country and that country has a
    single zone; a nautical/UTC zone or a country spanning several zones needs a check."""
    currencies = currency_options(country_code)
    zone = timezone_at(lat, lon)
    zones = timezone_options(country_code)
    return RegionSettings(
        currency=currencies[0] if currencies else None,
        currency_options=currencies,
        currency_certain=len(currencies) == 1,
        timezone=zone,
        timezone_options=zones if zone in zones else (zone, *zones),
        timezone_certain=zones == (zone,),
        unit_system=unit_system_for(country_code),
    )


def radius_bbox(lat: float, lon: float, radius_m: int) -> BBox:
    """Bounding box of a circle the person drew (approximate, spherical Earth). Refused
    where it would cross a pole or the antimeridian, which the gate does not support."""
    dlat = radius_m / 111_320
    dlon = radius_m / (111_320 * math.cos(math.radians(lat)))
    box = (lon - dlon, lat - dlat, lon + dlon, lat + dlat)
    if box[1] < -90 or box[3] > 90 or box[0] < -180 or box[2] > 180:
        raise ValueError("this radius crosses a pole or the 180° meridian; use a smaller one")
    return (round(box[0], 6), round(box[1], 6), round(box[2], 6), round(box[3], 6))


class AdminContext(Frozen):
    """Administrative names as the provider or person gave them (display only)."""

    country_name: str | None = Field(default=None, max_length=120)
    admin1: str | None = Field(default=None, max_length=120)
    admin2: str | None = Field(default=None, max_length=120)
    locality: str | None = Field(default=None, max_length=120)
    sublocality: str | None = Field(default=None, max_length=120)


class PlaceCandidate(Frozen):
    """One possible match for a search or a point, before anyone confirms it."""

    place_id: str = Field(pattern=PLACE_ID.pattern)
    name: str = Field(min_length=1, max_length=200)
    formatted_address: str | None = Field(default=None, max_length=300)
    latitude: DecimalString
    longitude: DecimalString
    country_code: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    admin: AdminContext = AdminContext()
    types: tuple[str, ...] = Field(default=(), max_length=30)
    viewport: BBox | None = None
    """The provider's display viewport. Never a boundary."""

    @property
    def scope(self) -> GeographicScope:
        return scope_from_types(self.types)


class LocationResolution(Frozen):
    """Candidates for free text (search box or agent message). Nothing is chosen for the
    person: one candidate still needs confirmation; several need a choice."""

    query: str
    candidates: tuple[PlaceCandidate, ...]
    needs_clarification: bool
    question: str
