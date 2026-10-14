"""Generated artifacts in private object storage (ADR 0007).

Keys are built only by the server, never taken from a client, and always have the form
``<kind>/<owner uid>/<resource id>/<name>``: the owner segment lets every read prove the
artifact belongs to the record that points at it. Content types are allow-listed and
each has a size limit enforced on write and before a read loads the body.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

from waterlens.application.ports import (
    ObjectNotFoundError,
    ObjectStorage,
    ObjectTooLargeError,
    StorageKeyError,
)
from waterlens.domain.errors import DomainError, ErrorCode

PDF = "application/pdf"
JSON = "application/json"
HTML = "text/html"
CSV = "text/csv"
NDJSON = "application/x-ndjson"

MAX_BYTES: dict[str, int] = {
    PDF: 5 * 1024 * 1024,
    HTML: 256 * 1024,
    JSON: 256 * 1024,
    CSV: 10 * 1024 * 1024,
    NDJSON: 10 * 1024 * 1024,
}
_MAGIC: dict[str, bytes] = {
    PDF: b"%PDF-",
    JSON: b"{",
    HTML: b"<",
    CSV: b"",
    NDJSON: b"{",
}

SYSTEM_OWNER = "system"
"""Owner segment for operator imports (source raw evidence and normalized series). No
user-facing route reads this prefix."""

_SEGMENT = re.compile(r"[A-Za-z0-9_-]{1,128}")
_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,99}")


class ArtifactKind(StrEnum):
    PROPOSAL = "proposals"
    SOURCE = "sources"


@dataclass(frozen=True, slots=True)
class ArtifactKey:
    kind: ArtifactKind
    owner_uid: str
    resource_id: str
    name: str

    def __post_init__(self) -> None:
        for value in (self.owner_uid, self.resource_id):
            if not _SEGMENT.fullmatch(value):
                raise StorageKeyError("artifact key segment is not allowed")
        if not _NAME.fullmatch(self.name) or ".." in self.name:
            raise StorageKeyError("artifact name is not allowed")

    def __str__(self) -> str:
        return f"{self.kind.value}/{self.owner_uid}/{self.resource_id}/{self.name}"

    @staticmethod
    def parse(key: str) -> ArtifactKey:
        parts = key.split("/")
        if len(parts) != 4:
            raise StorageKeyError("artifact key has the wrong shape")
        try:
            kind = ArtifactKind(parts[0])
        except ValueError:
            raise StorageKeyError("unknown artifact kind") from None
        return ArtifactKey(kind, parts[1], parts[2], parts[3])


def _limit(content_type: str) -> int:
    try:
        return MAX_BYTES[content_type]
    except KeyError:
        raise DomainError(ErrorCode.VALIDATION_FAILED, "this file type is not allowed") from None


class ArtifactStore:
    def __init__(self, storage: ObjectStorage) -> None:
        self._storage = storage

    def put(self, key: ArtifactKey, data: bytes, content_type: str) -> str:
        """Create-only write (identical bytes again are a no-op). Returns the key."""
        if len(data) > _limit(content_type):
            raise DomainError(ErrorCode.VALIDATION_FAILED, "the generated file is too large")
        if not data.startswith(_MAGIC[content_type]):
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, "the generated file does not match its type"
            )
        self._storage.put(str(key), data, content_type=content_type)
        return str(key)

    def read_owned(self, key: str, owner_uid: str, content_type: str) -> bytes:
        """Read an artifact a record owned by ``owner_uid`` points at. A key outside
        that owner's prefix is reported as missing, never read."""
        try:
            parsed = ArtifactKey.parse(key)
        except StorageKeyError:
            raise DomainError(ErrorCode.NOT_FOUND, "file not found") from None
        if parsed.owner_uid != owner_uid:
            raise DomainError(ErrorCode.NOT_FOUND, "file not found")
        try:
            return self._storage.get(str(parsed), max_bytes=_limit(content_type))
        except ObjectNotFoundError:
            raise DomainError(ErrorCode.NOT_FOUND, "file not found") from None
        except ObjectTooLargeError:
            raise DomainError(ErrorCode.INTERNAL, "this file cannot be delivered") from None
