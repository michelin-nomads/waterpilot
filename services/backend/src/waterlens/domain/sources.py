"""Source provenance at runtime (ADR 0008).

``SourceManifest`` is the runtime form of ``docs/domain/source-manifest.schema.json``
(v0.3): it accepts every valid example and rejects every invalid one (parity test in
``tests/domain/test_source_runtime.py``). Four separate records keep apart what the
data-readiness gate must never conflate:

* ``SourceRegistration`` — catalogued metadata and the current licence review. Nothing
  imported; never evidence by itself.
* ``SourceSnapshot`` — one immutable imported raw object (checksum, private raw key,
  normalized series) with its own coverage and review status.
* ``IngestionRun`` — what happened when an import was attempted (succeeded, duplicate,
  rejected, failed). A failed run never creates a snapshot.
* ``ConnectivityCheck`` — whether the publisher URL answered. Reachability is not a
  licence, and a licence is not reachability; neither is coverage.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any, Literal, Self
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

from waterlens.domain.planning import Capability
from waterlens.domain.records import Record
from waterlens.domain.units import CanonicalUnit
from waterlens.domain.values import DecimalString, EvidenceQuality, utc_iso

MANIFEST_SCHEMA_VERSION = "0.3"
SLUG_PATTERN = r"^[a-z0-9][a-z0-9-]{2,63}$"
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_OBJECT_REF = re.compile(r"^(?!/)(?!.*(^|/)\.\.(/|$))[A-Za-z0-9._/-]+$")
MAX_PROBLEMS = 50


def _iso_date(value: Any) -> Any:
    if isinstance(value, datetime):
        raise ValueError("expected a calendar date, not a timestamp")
    if isinstance(value, str):
        if not _DATE_RE.fullmatch(value):
            raise ValueError(f"{value!r} is not a 'date' (YYYY-MM-DD)")
        try:
            return date.fromisoformat(value)
        except ValueError:
            raise ValueError(f"{value!r} is not a 'date'") from None
    return value


def _z_instant(value: Any) -> Any:
    if isinstance(value, str):
        if not value.endswith("Z"):
            raise ValueError("timestamps must be UTC with a 'Z' suffix (does not match 'Z$')")
        return datetime.fromisoformat(value)
    return value


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamps must be timezone-aware UTC instants")
    return value


def _object_ref(value: str) -> str:
    if not _OBJECT_REF.fullmatch(value) or len(value) > 500:
        raise ValueError(f"{value!r} does not match the relative object-key pattern")
    return value


def _http_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise ValueError("expected an absolute http(s) URL")
    return value


IsoDate = Annotated[date, BeforeValidator(_iso_date)]
ZInstant = Annotated[
    datetime,
    BeforeValidator(_z_instant),
    AfterValidator(_aware),
    PlainSerializer(utc_iso, when_used="json"),
]
HttpUrl = Annotated[str, AfterValidator(_http_url)]
ObjectRef = Annotated[str, AfterValidator(_object_ref)]
Slug = Annotated[str, Field(pattern=SLUG_PATTERN)]


class Manifest(BaseModel):
    model_config = ConfigDict(
        frozen=True, extra="forbid", alias_generator=to_camel, populate_by_name=True
    )

    def to_json(self) -> dict[str, Any]:
        """The schema's camelCase JSON form (absent optional fields omitted)."""
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


class RecordKind(StrEnum):
    REGISTERED_SOURCE = "registered_source"
    INGESTED_SNAPSHOT = "ingested_snapshot"


class UsageRights(StrEnum):
    UNVERIFIED = "unverified"
    OPEN = "open"
    NON_COMMERCIAL = "non_commercial"
    BY_AGREEMENT = "by_agreement"
    RESTRICTED = "restricted"
    PROHIBITED = "prohibited"


GRANTING_RIGHTS = frozenset(
    {UsageRights.OPEN, UsageRights.NON_COMMERCIAL, UsageRights.BY_AGREEMENT, UsageRights.RESTRICTED}
)
"""Rights that *can* be authorized after review; ``unverified``/``prohibited`` never can."""


class AuthorizationStatus(StrEnum):
    NOT_REVIEWED = "not_reviewed"
    AUTHORIZED = "authorized"
    NOT_AUTHORIZED = "not_authorized"


class AuthorizedUse(StrEnum):
    INTERNAL_ANALYSIS = "internal_analysis"
    DERIVED_METRICS = "derived_metrics"
    PILOT_DISPLAY = "pilot_display"
    REDISTRIBUTION = "redistribution"
    COMMERCIAL_USE = "commercial_use"


DISPLAY_USES = frozenset({AuthorizedUse.DERIVED_METRICS, AuthorizedUse.PILOT_DISPLAY})
"""Gate criterion 1: the minimum authorized uses for an on-screen metric."""
RETENTION_USES = frozenset({AuthorizedUse.INTERNAL_ANALYSIS})
"""Keeping a private raw copy is internal analysis; importing needs at least this."""


class AccessTier(StrEnum):
    PUBLIC_GLOBAL = "public_global"
    LICENSED = "licensed"
    LOCAL_MEASURED = "local_measured"
    RESTRICTED = "restricted"


class SpatialType(StrEnum):
    BBOX = "bbox"
    GEOJSON_REF = "geojson_ref"
    ADMIN_AREA = "admin_area"


class ObservationMethod(StrEnum):
    """How the values were obtained (v0.3). Gate criterion 4 accepts only on-the-ground
    measurement or operator records as local measurement; imagery is not a substitute."""

    IN_SITU_MEASUREMENT = "in_situ_measurement"
    ADMINISTRATIVE_RECORD = "administrative_record"
    REMOTE_SENSING = "remote_sensing"
    MODEL_OUTPUT = "model_output"
    SURVEY = "survey"


LOCAL_MEASUREMENT_METHODS = frozenset(
    {ObservationMethod.IN_SITU_MEASUREMENT, ObservationMethod.ADMINISTRATIVE_RECORD}
)


class Authorization(Manifest):
    status: AuthorizationStatus
    authorized_uses: tuple[AuthorizedUse, ...] | None = None
    reviewed_at: IsoDate | None = None
    evidence_ref: str | None = Field(default=None, min_length=1)
    conditions: str | None = None

    @model_validator(mode="after")
    def _authorized_needs_evidence(self) -> Self:
        uses = self.authorized_uses or ()
        if len(set(uses)) != len(uses):
            raise ValueError("authorizedUses must not repeat a use")
        if self.status is AuthorizationStatus.AUTHORIZED:
            if not uses:
                raise ValueError("authorizedUses should be non-empty when authorized")
            if self.reviewed_at is None:
                raise ValueError("'reviewedAt' is a required property when authorized")
            if self.evidence_ref is None:
                raise ValueError("'evidenceRef' is a required property when authorized")
        return self


class Licence(Manifest):
    name: str = Field(min_length=1)
    url: HttpUrl | None = None
    usage_rights: UsageRights
    attribution_text: str | None = None
    authorization: Authorization

    @model_validator(mode="after")
    def _rights_bound_authorization(self) -> Self:
        if (
            self.usage_rights not in GRANTING_RIGHTS
            and self.authorization.status is AuthorizationStatus.AUTHORIZED
        ):
            raise ValueError(
                f"a {self.usage_rights.value!r} licence cannot be authorized (should not be valid)"
            )
        return self

    def permits(self, uses: frozenset[AuthorizedUse]) -> bool:
        """True only if the rights can grant and a review authorized every use."""
        auth = self.authorization
        return (
            self.usage_rights in GRANTING_RIGHTS
            and auth.status is AuthorizationStatus.AUTHORIZED
            and uses <= set(auth.authorized_uses or ())
        )


class UncertaintyKind(StrEnum):
    ABSOLUTE = "absolute"
    """± value in the variable's normalized unit."""
    RELATIVE = "relative"
    """± fraction of each value, as a ratio in [0, 1]."""
    NOT_QUANTIFIED = "not_quantified"
    """The publisher states no uncertainty; recorded so its absence is explicit."""


class Uncertainty(Manifest):
    kind: UncertaintyKind
    value: DecimalString | None = None
    basis: str | None = Field(default=None, min_length=1, max_length=500)

    @model_validator(mode="after")
    def _value_matches_kind(self) -> Self:
        if self.kind is UncertaintyKind.NOT_QUANTIFIED:
            if self.value is not None:
                raise ValueError("not_quantified uncertainty must not carry a value")
            return self
        if self.value is None:
            raise ValueError(f"{self.kind.value} uncertainty needs a value")
        amount = Decimal(self.value)
        if amount < 0 or (self.kind is UncertaintyKind.RELATIVE and amount > 1):
            raise ValueError("uncertainty must be non-negative (relative: within [0, 1])")
        return self


class Variable(Manifest):
    name: str = Field(min_length=1)
    parameter: str | None = None
    raw_unit: str = Field(min_length=1)
    normalized_unit: CanonicalUnit | None = None
    band_or_field: str | None = None
    scale_meters: float | None = Field(default=None, gt=0)
    uncertainty: Uncertainty | None = None

    @property
    def key(self) -> str:
        """What the variable measures: its ``parameter`` if given, else its name."""
        return self.parameter or self.name


class TemporalCoverage(Manifest):
    start: IsoDate
    end_exclusive: IsoDate
    boundary: Literal["half_open_start_inclusive_end_exclusive"]
    timezone: str = Field(min_length=1)

    @field_validator("timezone")
    @classmethod
    def _iana(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(
                f"temporalCoverage.timezone {value!r} is not a valid IANA timezone"
            ) from None
        return value

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.end_exclusive <= self.start:
            raise ValueError("temporalCoverage.endExclusive must be after start")
        return self

    @property
    def days(self) -> int:
        return (self.end_exclusive - self.start).days


Longitude = Annotated[float, Field(ge=-180, le=180)]
Latitude = Annotated[float, Field(ge=-90, le=90)]
BBox = tuple[Longitude, Latitude, Longitude, Latitude]


def bbox_contains(outer: BBox, inner: BBox) -> bool:
    return (
        outer[0] <= inner[0]
        and outer[1] <= inner[1]
        and inner[2] <= outer[2]
        and (inner[3] <= outer[3])
    )


def bbox_contains_point(box: BBox, lon: float, lat: float) -> bool:
    return box[0] <= lon <= box[2] and box[1] <= lat <= box[3]


class SpatialCoverage(Manifest):
    type: SpatialType
    crs: str = Field(pattern=r"^EPSG:[0-9]+$")
    bbox: BBox | None = None
    geojson_object_ref: str | None = Field(default=None, min_length=1)
    admin_area_id: str | None = Field(default=None, min_length=1)
    admin_area_scheme: str | None = None

    @model_validator(mode="after")
    def _discriminated(self) -> Self:
        if self.type is SpatialType.BBOX:
            if self.bbox is None:
                raise ValueError("'bbox' is a required property for a bbox footprint")
            if self.crs != "EPSG:4326":
                raise ValueError("'EPSG:4326' was expected for a bbox footprint")
            min_lon, min_lat, max_lon, max_lat = self.bbox
            if min_lon > max_lon or min_lat > max_lat:
                raise ValueError("spatialCoverage bbox min must not exceed max")
        elif self.type is SpatialType.GEOJSON_REF and self.geojson_object_ref is None:
            raise ValueError("'geojsonObjectRef' is a required property for geojson_ref")
        elif self.type is SpatialType.ADMIN_AREA and self.admin_area_id is None:
            raise ValueError("'adminAreaId' is a required property for admin_area")
        return self


class Checksum(Manifest):
    algo: Literal["sha256"]
    value: str = Field(pattern=r"^[a-f0-9]{64}$")


class Transformation(Manifest):
    """One recorded processing step (v0.3), e.g. ``unit`` MLD→L/day ×1000000."""

    step: str = Field(pattern=r"^[a-z][a-z0-9_]{1,40}$")
    detail: str = Field(min_length=1, max_length=500)


class SourceManifest(Manifest):
    id: Slug
    record_kind: RecordKind
    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    source_url: HttpUrl
    licence: Licence
    capability: Capability
    variables: tuple[Variable, ...] = Field(min_length=1, max_length=50)
    temporal_coverage: TemporalCoverage
    spatial_coverage: SpatialCoverage
    observation_timestamp: ZInstant | None = None
    ingestion_timestamp: ZInstant | None = None
    retrieved_at: ZInstant | None = None
    quality_status: EvidenceQuality
    quality_flags: tuple[str, ...] | None = None
    transformation_version: str | None = Field(default=None, min_length=1)
    transformations: tuple[Transformation, ...] | None = None
    checksum: Checksum | None = None
    raw_object_ref: ObjectRef | None = None
    normalized_object_ref: ObjectRef | None = None
    access_tier: AccessTier
    eligibility_notes: str | None = None
    requires_local_measurement: bool | None = None
    observation_method: ObservationMethod | None = None
    supersedes: str | None = None
    registered_source_id: Slug | None = None

    @model_validator(mode="after")
    def _kind_rules(self) -> Self:
        if self.record_kind is RecordKind.INGESTED_SNAPSHOT:
            for name in (
                "observation_timestamp",
                "ingestion_timestamp",
                "transformation_version",
                "raw_object_ref",
                "checksum",
            ):
                if getattr(self, name) is None:
                    raise ValueError(f"{to_camel(name)!r} is a required property for a snapshot")
        else:
            if self.quality_status not in {EvidenceQuality.UNREVIEWED, EvidenceQuality.SYNTHETIC}:
                raise ValueError(
                    f"{self.quality_status.value!r} is not one of ['unreviewed', 'synthetic'] "
                    "for a registered source"
                )
            imported = ("raw_object_ref", "checksum", "ingestion_timestamp")
            if any(getattr(self, n) is not None for n in imported) or (
                self.normalized_object_ref or self.registered_source_id
            ):
                raise ValueError(
                    "a registered source has imported nothing, so it should not be valid "
                    "with rawObjectRef, checksum, ingestionTimestamp or snapshot links"
                )
        if self.quality_status is EvidenceQuality.VALIDATED and any(
            v.normalized_unit is None for v in self.variables
        ):
            raise ValueError("'normalizedUnit' is a required property on every validated variable")
        names = [v.name for v in self.variables]
        if len(set(names)) != len(names):
            raise ValueError("variable names must be unique")
        return self


# --------------------------------------------------------------------------- records


class SourceRegistration(Record):
    """Catalogue entry; ``id`` is the manifest slug. Licence reviews replace it."""

    capability: Capability
    manifest: SourceManifest

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.manifest.record_kind is not RecordKind.REGISTERED_SOURCE:
            raise ValueError("a registration holds a registered_source manifest")
        if self.id != self.manifest.id or self.capability is not self.manifest.capability:
            raise ValueError("registration id/capability must match its manifest")
        return self


class SourceSnapshot(Record):
    """One immutable import. ``id`` is the snapshot manifest slug."""

    source_id: str
    capability: Capability
    manifest: SourceManifest
    row_count: int = Field(ge=0)
    missing_values: int = Field(ge=0)
    reviewed_by: str | None = Field(default=None, max_length=200)
    review_evidence: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        m = self.manifest
        if m.record_kind is not RecordKind.INGESTED_SNAPSHOT:
            raise ValueError("a snapshot holds an ingested_snapshot manifest")
        if self.id != m.id or m.registered_source_id != self.source_id:
            raise ValueError("snapshot id/source must match its manifest")
        if self.capability is not m.capability:
            raise ValueError("snapshot capability must match its manifest")
        if m.quality_status is EvidenceQuality.VALIDATED and not (
            self.reviewed_by and self.review_evidence
        ):
            raise ValueError("a validated snapshot records who reviewed it and the evidence")
        return self


class IngestionStatus(StrEnum):
    SUCCEEDED = "succeeded"
    DUPLICATE = "duplicate"
    """Identical bytes were already imported; the existing snapshot is reused."""
    REJECTED = "rejected"
    """Licence, parsing or compatibility checks refused the input; nothing was stored."""
    FAILED = "failed"
    """An infrastructure error (fetch, storage) stopped the import; safe to retry."""


class IngestionRun(Record):
    source_id: str
    status: IngestionStatus
    trigger: str = Field(min_length=1, max_length=80)
    snapshot_id: str | None = None
    checksum: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    problems: tuple[str, ...] = Field(default=(), max_length=MAX_PROBLEMS)

    @model_validator(mode="after")
    def _snapshot_only_on_success(self) -> Self:
        stored = self.status in {IngestionStatus.SUCCEEDED, IngestionStatus.DUPLICATE}
        if stored != (self.snapshot_id is not None):
            raise ValueError("only a successful or duplicate run references a snapshot")
        if self.status is IngestionStatus.REJECTED and not self.problems:
            raise ValueError("a rejected run lists its problems")
        return self


class ConnectivityOutcome(StrEnum):
    REACHABLE = "reachable"
    UNREACHABLE = "unreachable"
    REFUSED = "refused"
    """WaterLens declined to connect (not https, host not the registered host)."""


class ConnectivityCheck(Record):
    source_id: str
    outcome: ConnectivityOutcome
    checked_url: str = Field(max_length=2000)
    http_status: int | None = Field(default=None, ge=100, le=599)
    detail: str = Field(default="", max_length=500)
