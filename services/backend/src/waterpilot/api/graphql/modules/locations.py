"""Choosing a location: candidates for text or a point, countries, and confirmation
(ADR 0009). Lookups need a signed-in (guest or permanent) caller."""

from __future__ import annotations

import strawberry

from waterpilot.api.graphql.context import Info, attempt, call
from waterpilot.api.graphql.modules.planning import AdminContext, Area
from waterpilot.api.graphql.scalars import DecimalString
from waterpilot.api.graphql.types_common import MutationError, input_data
from waterpilot.domain import location as dl


@strawberry.type
class PlaceCandidate:
    place_id: str
    name: str
    formatted_address: str | None
    latitude: DecimalString
    longitude: DecimalString
    country_code: str | None
    admin: AdminContext
    types: list[str]
    scope: dl.GeographicScope

    @staticmethod
    def of(c: dl.PlaceCandidate) -> PlaceCandidate:
        return PlaceCandidate(
            place_id=c.place_id,
            name=c.name,
            formatted_address=c.formatted_address,
            latitude=DecimalString(c.latitude),
            longitude=DecimalString(c.longitude),
            country_code=c.country_code,
            admin=AdminContext.of(c.admin),
            types=list(c.types),
            scope=c.scope,
        )


@strawberry.type
class LocationResolution:
    query: str
    candidates: list[PlaceCandidate]
    needs_clarification: bool = strawberry.field(
        description="Several places match: ask which one. Nothing is chosen for the person."
    )
    question: str = strawberry.field(description="What to ask the person next.")
    provider: str = strawberry.field(description="google, fixture (local test data) or none.")


@strawberry.type
class Country:
    code: str
    name: str


@strawberry.type
class NearbyPlaces:
    candidates: list[PlaceCandidate] = strawberry.field(description="At most 5, nearest first.")


@strawberry.type
class CountryList:
    countries: list[Country] = strawberry.field(
        description="Fixed CLDR list (about 250 entries), sorted by English name."
    )


@strawberry.type
class RegionSettings:
    currency: str | None = strawberry.field(description="Null where CLDR lists no tender.")
    currency_options: list[str]
    currency_certain: bool = strawberry.field(
        description="False when the country has several tenders: ask the person to check."
    )
    timezone: str
    timezone_options: list[str]
    timezone_certain: bool = strawberry.field(
        description="False when the country spans several zones or the point is offshore."
    )
    unit_system: dl.UnitSystem


@strawberry.type
class Query:
    @strawberry.field(description="Candidate places for free text (search or agent message).")
    async def resolve_location(self, info: Info, text: str) -> LocationResolution:
        services = info.context.services
        r = await call(services.locations.resolve, info.context.ctx, text)
        return LocationResolution(
            query=r.query,
            candidates=[PlaceCandidate.of(c) for c in r.candidates],
            needs_clarification=r.needs_clarification,
            question=r.question,
            provider=services.deps.places.provider,
        )

    @strawberry.field(description="Places near a point; empty when none is known.")
    async def reverse_location(
        self, info: Info, latitude: DecimalString, longitude: DecimalString
    ) -> NearbyPlaces:
        found = await call(
            info.context.services.locations.reverse, info.context.ctx, latitude, longitude
        )
        return NearbyPlaces(candidates=[PlaceCandidate.of(c) for c in found])

    @strawberry.field(
        description="Region settings a confirmation would infer for a point in a country, "
        "with how certain each is. Never derived from the interface language."
    )
    async def region_settings(
        self, info: Info, latitude: DecimalString, longitude: DecimalString, country_code: str
    ) -> RegionSettings:
        r = await call(
            info.context.services.locations.region,
            info.context.ctx,
            latitude,
            longitude,
            country_code,
        )
        return RegionSettings(
            currency=r.currency,
            currency_options=list(r.currency_options),
            currency_certain=r.currency_certain,
            timezone=r.timezone,
            timezone_options=list(r.timezone_options),
            timezone_certain=r.timezone_certain,
            unit_system=r.unit_system,
        )

    @strawberry.field(description="Countries (ISO 3166-1 alpha-2) with English names, from CLDR.")
    def countries(self, info: Info) -> CountryList:
        return CountryList(
            countries=[
                Country(code=code, name=name)
                for code, name in info.context.services.locations.countries().items()
            ]
        )


@strawberry.input
class AdminContextInput:
    country_name: str | None = None
    admin1: str | None = None
    admin2: str | None = None
    locality: str | None = None
    sublocality: str | None = None


@strawberry.input
class ConfirmLocationInput:
    origin: dl.AreaOrigin = strawberry.field(description="PLACE_SEARCH, GEOLOCATION or CUSTOM.")
    place_id: str | None = None
    name: str
    formatted_address: str | None = None
    latitude: DecimalString
    longitude: DecimalString
    country_code: str
    admin: AdminContextInput | None = None
    types: list[str] = strawberry.field(default_factory=list)
    accuracy_meters: int | None = None
    extent: dl.ExtentKind = strawberry.field(
        description="Required: REFERENCE_POINT or USER_RADIUS, chosen by the person."
    )
    radius_meters: int | None = None
    timezone: str | None = strawberry.field(
        default=None, description="IANA zone correcting the inferred one."
    )
    currency: str | None = strawberry.field(
        default=None, description="ISO 4217 code correcting the inferred one."
    )
    idempotency_key: str


@strawberry.type
class ConfirmLocationPayload:
    area: Area | None = None
    error: MutationError | None = None


@strawberry.type
class Mutation:
    @strawberry.mutation(
        description="Store a location you confirmed and return its area. Set the session's "
        "areaId afterwards with updatePlanningSession."
    )
    async def confirm_location(
        self, info: Info, input: ConfirmLocationInput
    ) -> ConfirmLocationPayload:
        service, ctx = info.context.services.locations, info.context.ctx
        data = input_data(input)
        if data.get("admin") is None:
            data.pop("admin", None)
        return await attempt(
            info,
            lambda: ConfirmLocationPayload(
                area=Area.of(service.confirm(ctx, data, input.idempotency_key))
            ),
            lambda e: ConfirmLocationPayload(error=e),
        )
