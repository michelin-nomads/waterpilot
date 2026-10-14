"""Choosing a location (ADR 0009).

``resolve`` turns free text (the search box in local mode, or an agent message) into
candidates and never picks one: several candidates need a choice, one still needs
confirmation. ``confirm`` stores what the person confirmed as an area, with region
settings derived from its country and coordinates. It does not change the planning
session; the session coordinator sets ``areaId`` afterwards (ADR 0006).
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from pydantic import Field

from waterlens.application.idempotency import run_once
from waterlens.application.identity import RequestContext
from waterlens.application.ports import PlaceSearchUnavailable
from waterlens.application.services.common import Deps, build
from waterlens.domain.errors import DomainError, ErrorCode, FieldError
from waterlens.domain.ids import IdKind, derived_id
from waterlens.domain.location import (
    MAX_RADIUS_M,
    MIN_RADIUS_M,
    PLACE_ID,
    PRIVATE_ORIGINS,
    PROVIDER_CONTENT_DAYS,
    AdminContext,
    AreaOrigin,
    ExtentKind,
    LocationResolution,
    PlaceCandidate,
    RegionSettings,
    country_names,
    is_currency,
    is_timezone,
    radius_bbox,
    region_settings,
    scope_from_types,
)
from waterlens.domain.planning import Area
from waterlens.domain.values import DecimalString, EvidenceQuality, Frozen

MAX_CANDIDATES = 5
COORD_PLACES = 7


class ConfirmLocationInput(Frozen):
    origin: AreaOrigin
    place_id: str | None = None
    name: str = Field(min_length=1, max_length=200)
    formatted_address: str | None = Field(default=None, max_length=300)
    latitude: DecimalString
    longitude: DecimalString
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    admin: AdminContext = AdminContext()
    types: tuple[str, ...] = Field(default=(), max_length=30)
    accuracy_meters: int | None = Field(default=None, ge=0, le=10_000_000)
    extent: ExtentKind
    """Required: how calculations treat the place is always the person's explicit choice."""
    radius_meters: int | None = None
    timezone: str | None = None
    """A correction of the inferred time zone; ``None`` keeps the inferred one."""
    currency: str | None = None
    """A correction of the inferred currency; ``None`` keeps the inferred one."""


def _invalid(*errors: tuple[str, str]) -> DomainError:
    return DomainError(
        ErrorCode.VALIDATION_FAILED,
        "some fields need attention",
        field_errors=tuple(FieldError(f, m) for f, m in errors),
    )


def _coordinate(raw: str, field: str, bound: int) -> float:
    try:
        value = Decimal(raw)
    except InvalidOperation:
        raise _invalid((field, "enter a decimal number of degrees")) from None
    exponent = value.as_tuple().exponent
    if isinstance(exponent, int) and -exponent > COORD_PLACES:
        raise _invalid((field, f"use at most {COORD_PLACES} decimal places"))
    if not -bound <= value <= bound:
        raise _invalid((field, f"must be between -{bound} and {bound}"))
    return float(value)


def _clarify(text: str, candidates: tuple[PlaceCandidate, ...]) -> tuple[bool, str]:
    if not candidates:
        return False, (
            f"No place matched “{text}”. Add the city or country, or enter the location "
            "yourself with its coordinates."
        )
    if len(candidates) == 1:
        c = candidates[0]
        return False, f"Is this the place you mean: {c.formatted_address or c.name}?"
    return True, f"“{text}” matches {len(candidates)} places. Which one do you mean?"


class LocationService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def _places(self, ctx: RequestContext) -> None:
        ctx.require_principal()  # lookups may be billed: signed-in (guest) callers only

    def resolve(self, ctx: RequestContext, text: str) -> LocationResolution:
        self._places(ctx)
        query = " ".join(text.split())
        if not 2 <= len(query) <= 100:
            raise _invalid(("text", "type 2-100 characters"))
        try:
            candidates = self._d.places.search(query, MAX_CANDIDATES)
        except PlaceSearchUnavailable:
            raise DomainError(
                ErrorCode.SERVICE_UNAVAILABLE,
                "place search is unavailable; enter the location yourself",
            ) from None
        ambiguous, question = _clarify(query, candidates)
        return LocationResolution(
            query=query, candidates=candidates, needs_clarification=ambiguous, question=question
        )

    def reverse(
        self, ctx: RequestContext, latitude: str, longitude: str
    ) -> tuple[PlaceCandidate, ...]:
        self._places(ctx)
        lat = _coordinate(latitude, "latitude", 90)
        lon = _coordinate(longitude, "longitude", 180)
        try:
            return self._d.places.reverse(lat, lon, MAX_CANDIDATES)
        except PlaceSearchUnavailable:
            return ()

    @staticmethod
    def countries() -> dict[str, str]:
        return country_names()

    def region(
        self, ctx: RequestContext, latitude: str, longitude: str, country_code: str
    ) -> RegionSettings:
        """Preview of the region settings a confirmation would infer, for checking."""
        ctx.require_principal()
        lat = _coordinate(latitude, "latitude", 90)
        lon = _coordinate(longitude, "longitude", 180)
        if country_code not in country_names():
            raise _invalid(("countryCode", "choose a country from the list"))
        return region_settings(lat, lon, country_code)

    # ------------------------------------------------------------------ confirm

    def _validate(self, p: ConfirmLocationInput) -> tuple[float, float]:
        errors: list[tuple[str, str]] = []
        if not p.name.strip():
            errors.append(("name", "enter a name for this location"))
        if p.origin is AreaOrigin.CATALOGUE:
            errors.append(("origin", "catalogue areas are chosen by id, not confirmed"))
        if p.origin is AreaOrigin.PLACE_SEARCH:
            provider = self._d.places.provider
            if p.place_id is None or not PLACE_ID.match(p.place_id):
                errors.append(("placeId", "a searched place needs its place id"))
            elif not p.place_id.startswith(f"{provider}:"):
                errors.append(("placeId", f"place ids here come from {provider}"))
        elif p.place_id is not None:
            errors.append(("placeId", "only searched places carry a place id"))
        if p.accuracy_meters is not None and p.origin is not AreaOrigin.GEOLOCATION:
            errors.append(("accuracyMeters", "accuracy applies to device locations only"))
        if p.country_code not in country_names():
            errors.append(("countryCode", "choose a country from the list"))
        if p.extent is ExtentKind.REVIEWED_BOUNDARY:
            errors.append(("extent", "only catalogue areas have a reviewed boundary"))
        if p.extent is ExtentKind.USER_RADIUS:
            if p.radius_meters is None or not MIN_RADIUS_M <= p.radius_meters <= MAX_RADIUS_M:
                errors.append(
                    (
                        "radiusMeters",
                        f"enter a radius from {MIN_RADIUS_M} m to {MAX_RADIUS_M // 1000} km",
                    )
                )
        elif p.radius_meters is not None:
            errors.append(("radiusMeters", "a radius needs the radius extent"))
        if p.timezone is not None and not is_timezone(p.timezone):
            errors.append(("timezone", "choose a time zone from the list"))
        if p.currency is not None and not is_currency(p.currency):
            errors.append(("currency", "choose a currency from the list"))
        if any(len(t) > 60 for t in p.types):
            errors.append(("types", "place types must be at most 60 characters"))
        if errors:
            raise _invalid(*errors)
        return _coordinate(p.latitude, "latitude", 90), _coordinate(p.longitude, "longitude", 180)

    def _area(self, p: ConfirmLocationInput, uid: str, lat: float, lon: float) -> Area:
        private = p.origin in PRIVATE_ORIGINS
        radius = p.radius_meters if p.extent is ExtentKind.USER_RADIUS else None
        # Every confirmed detail is part of the id, so a confirmation can only create an
        # area or reuse an identical one; it can never rewrite an area someone else uses.
        owner = uid if private else "shared"
        area_id = derived_id(IdKind.AREA, p.origin.value, owner, p.model_dump_json())
        inferred = region_settings(lat, lon, p.country_code)
        timezone = p.timezone or inferred.timezone
        currency = p.currency or inferred.currency
        overrides: tuple[
            tuple[Literal["currency", "timezone"], str | None, str | None], ...
        ] = (
            ("currency", p.currency, inferred.currency),
            ("timezone", p.timezone, inferred.timezone),
        )
        set_by_user = tuple(
            field
            for field, chosen, guess in overrides
            if chosen is not None and chosen != guess
        )
        try:
            box = radius_bbox(lat, lon, radius) if radius is not None else None
        except ValueError as err:
            raise _invalid(("radiusMeters", str(err))) from None
        now = self._d.clock()
        existing = self._d.store.areas.get(area_id)
        from_provider = p.origin is AreaOrigin.PLACE_SEARCH and self._d.places.provider == "google"
        evidence = {
            AreaOrigin.PLACE_SEARCH: (
                EvidenceQuality.PROVISIONAL if from_provider else EvidenceQuality.SYNTHETIC
            ),
            AreaOrigin.GEOLOCATION: EvidenceQuality.UNREVIEWED,
            AreaOrigin.CUSTOM: EvidenceQuality.UNREVIEWED,
        }[p.origin]
        return Area(
            id=area_id,
            name=p.name.strip(),
            country_code=p.country_code,
            timezone=timezone,
            centroid_lat=p.latitude,
            centroid_lon=p.longitude,
            evidence=evidence,
            created_at=existing.created_at if existing else now,
            boundary_bbox=box,
            origin=p.origin,
            extent=p.extent,
            radius_m=radius,
            place_id=p.place_id,
            owner_uid=uid if private else None,
            scope=scope_from_types(p.types),
            admin=p.admin,
            formatted_address=p.formatted_address,
            accuracy_m=p.accuracy_meters,
            currency=currency,
            unit_system=inferred.unit_system,
            region_set_by_user=set_by_user,
            provider_expires_at=(
                now + timedelta(days=PROVIDER_CONTENT_DAYS) if from_provider else None
            ),
        )

    def confirm(self, ctx: RequestContext, data: dict[str, Any], idempotency_key: str) -> Area:
        principal = ctx.require_principal()
        payload = build(ConfirmLocationInput, data)
        lat, lon = self._validate(payload)
        area = self._area(payload, principal.uid, lat, lon)
        store = self._d.store

        def create() -> tuple[str, ...]:
            store.areas.add(area)
            return (area.id,)

        def tx() -> tuple[str, ...]:
            return run_once(
                store,
                uid=principal.uid,
                operation="confirmLocation",
                key=idempotency_key,
                payload=payload,
                now=self._d.clock(),
                create=create,
            )

        (area_id,) = store.transaction(tx)
        stored = store.areas.get(area_id)
        return stored if stored is not None else area
