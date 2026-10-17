"""Small, offline, human-reviewed funding catalogue; never a crawler or model publisher."""

from __future__ import annotations

import base64
import binascii
import hashlib
import ipaddress
import json
import re
from typing import Any
from urllib.parse import urlsplit

from pydantic import Field, ValidationError

from waterpilot.application.artifacts import (
    JSON,
    MAX_BYTES,
    PDF,
    SYSTEM_OWNER,
    ArtifactKey,
    ArtifactKind,
    ArtifactStore,
)
from waterpilot.application.identity import RequestContext
from waterpilot.application.services.common import Deps
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.funding import CatalogueStatus, FundingScheme
from waterpilot.domain.ids import IdKind, require_id
from waterpilot.domain.values import EvidenceQuality, Frozen

MAX_CATALOGUE = 200
MAX_IMPORT_BYTES = 8 * 1024 * 1024


class CatalogueImport(Frozen):
    scheme: dict[str, Any]
    expected_revision: int = Field(ge=0)
    human_reviewed: bool = False
    source_document_base64: str | None = Field(default=None, max_length=7 * 1024 * 1024)
    source_content_type: str = JSON


def source_url(value: str) -> None:
    """Metadata only: URLs are never fetched. Refuse credentials and private/literal hosts."""
    try:
        parts = urlsplit(value)
        host = parts.hostname or ""
        if (
            parts.scheme != "https"
            or parts.username
            or parts.password
            or parts.port not in {None, 443}
        ):
            raise ValueError
        if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?", host):
            raise ValueError
        if "." not in host or host.endswith((".localhost", ".local", ".internal")):
            raise ValueError
        try:
            ipaddress.ip_address(host)
        except ValueError:
            if all(part.isdigit() for part in host.split(".")):
                raise ValueError from None
        else:
            raise ValueError
    except ValueError:
        raise DomainError(
            ErrorCode.VALIDATION_FAILED, "source URL must be public HTTPS metadata"
        ) from None


class FundingCatalogueAdmin:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    @staticmethod
    def authorize(ctx: RequestContext, admins: frozenset[str]) -> str:
        principal = ctx.require_permanent()
        if principal.uid not in admins:
            raise DomainError(
                ErrorCode.FORBIDDEN, "funding catalogue administration requires an admin"
            )
        return principal.uid

    def list(self, ctx: RequestContext, admins: frozenset[str]) -> tuple[FundingScheme, ...]:
        self.authorize(ctx, admins)
        now = self._d.clock()
        return tuple(
            s.model_copy(update={"status": s.effective_status(now)})
            for s in self._d.store.funding_schemes.all_active(MAX_CATALOGUE)
        )

    def import_scheme(
        self,
        ctx: RequestContext,
        admins: frozenset[str],
        body: CatalogueImport,
        artifacts: ArtifactStore,
    ) -> FundingScheme:
        reviewer = self.authorize(ctx, admins)
        now = self._d.clock()
        data = dict(body.scheme)
        if len(json.dumps(data).encode()) > 128 * 1024:
            raise DomainError(ErrorCode.VALIDATION_FAILED, "scheme metadata exceeds 128 KiB")
        # Preserve unrecognized curator fields rather than silently dropping them.
        extras = {k: data.pop(k) for k in tuple(data) if k not in FundingScheme.model_fields}
        unknown = data.get("unknown_metadata", {})
        if not isinstance(unknown, dict):
            raise DomainError(ErrorCode.VALIDATION_FAILED, "unknown_metadata must be an object")
        data["unknown_metadata"] = {**unknown, **extras}
        data["reviewed_by"] = reviewer if body.human_reviewed else None
        data["revision"] = body.expected_revision + 1
        data["source_document_key"] = None
        raw: bytes | None = None
        if body.source_document_base64 is not None:
            if body.source_content_type not in {JSON, PDF}:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "only permitted JSON/PDF documents are accepted"
                )
            try:
                raw = base64.b64decode(body.source_document_base64, validate=True)
            except (ValueError, binascii.Error):
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "source document must be valid base64"
                ) from None
            if not raw or len(raw) > MAX_BYTES[body.source_content_type]:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "source document is empty or too large"
                )
            data["source_hash"] = hashlib.sha256(raw).hexdigest()
        try:
            scheme = FundingScheme.model_validate(data)
            require_id(scheme.id, IdKind.FUNDING_SCHEME)
            source_url(scheme.source_url)
        except (ValidationError, ValueError, KeyError) as err:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, f"invalid funding metadata: {err}"
            ) from None
        if scheme.last_verified_at > now:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, "verification date cannot be in the future"
            )
        if scheme.status is CatalogueStatus.ACTIVE and (
            not body.human_reviewed
            or not scheme.official_source
            or scheme.evidence is not EvidenceQuality.VALIDATED
            or not scheme.permission_note
            or not scheme.source_hash
            or not scheme.deadline_timezone
        ):
            raise DomainError(
                ErrorCode.VALIDATION_FAILED,
                "active publication requires human review, official permitted evidence, "
                "hash and timezone",
            )
        scheme = scheme.model_copy(update={"status": scheme.effective_status(now)})

        def save() -> FundingScheme:
            store = self._d.store
            store.lock_owner("funding-catalogue")
            current = store.funding_schemes.get(scheme.id)
            if (current.revision if current else 0) != body.expected_revision:
                raise DomainError(
                    ErrorCode.VERSION_CONFLICT, "catalogue changed; reload before saving"
                )
            if (
                current is None
                and len(store.funding_schemes.all_active(MAX_CATALOGUE)) >= MAX_CATALOGUE
            ):
                raise DomainError(
                    ErrorCode.PRECONDITION_FAILED, "catalogue is limited to 200 schemes"
                )
            if (
                current is not None
                and current.evidence is EvidenceQuality.SYNTHETIC
                and scheme.evidence is not EvidenceQuality.SYNTHETIC
            ):
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "synthetic records cannot become real schemes"
                )
            if (
                current is not None
                and raw is None
                and (
                    scheme.source_hash != current.source_hash
                    or scheme.source_url != current.source_url
                )
            ):
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "changed source requires its permitted document"
                )
            if (
                scheme.status is CatalogueStatus.ACTIVE
                and raw is None
                and (current is None or not current.source_document_key)
            ):
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED,
                    "first publication requires the permitted source document",
                )
            saved = scheme.model_copy(
                update={
                    "source_document_key": document_key
                    if raw is not None
                    else (current.source_document_key if current else None)
                }
            )
            store.funding_schemes.save(saved, body.expected_revision)
            return saved

        # Store immutable evidence outside transaction callbacks (retries must have no I/O effects).
        document_key: str | None = None
        if raw is not None:
            if not scheme.permission_note:
                raise DomainError(
                    ErrorCode.VALIDATION_FAILED, "record document permission before importing"
                )
            extension = "pdf" if body.source_content_type == PDF else "json"
            document_key = artifacts.put(
                ArtifactKey(
                    ArtifactKind.SOURCE,
                    SYSTEM_OWNER,
                    scheme.id,
                    f"{scheme.source_hash}.{extension}",
                ),
                raw,
                body.source_content_type,
            )
        return self._d.store.transaction(save)
