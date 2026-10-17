"""Private Cloud Storage object storage (cloud mode).

Same contract as the local adapter: create-only objects (``if_generation_match=0``;
identical bytes again are a no-op, different bytes conflict), size checked from object
metadata before the body is downloaded, and keys validated before any request. The
bucket must enforce public access prevention and uniform bucket-level access;
``check_private`` verifies that and the factory refuses a bucket that fails it.
Credentials come from the runtime service identity (ADC), never from a key file.
"""

from __future__ import annotations

import base64
import hashlib
from typing import Any, Protocol

from google.api_core import exceptions as gexc

from waterpilot.application.ports import (
    ObjectConflictError,
    ObjectNotFoundError,
    ObjectTooLargeError,
    StorageKeyError,
)

MAX_KEY_LENGTH = 1024


class _Blob(Protocol):
    size: int | None
    md5_hash: str | None
    generation: int | None

    def upload_from_string(
        self, data: bytes, *, content_type: str, if_generation_match: int
    ) -> None: ...

    def download_as_bytes(self, *, if_generation_match: int | None) -> bytes: ...

    def exists(self) -> bool: ...


class _Bucket(Protocol):
    name: str
    iam_configuration: Any

    def blob(self, name: str) -> _Blob: ...

    def get_blob(self, name: str) -> _Blob | None: ...

    def reload(self) -> None: ...


class PublicBucketError(RuntimeError):
    """The configured bucket could be made public; artifacts must stay private."""


def validate_key(key: str) -> str:
    parts = key.split("/")
    if (
        not key
        or len(key.encode()) > MAX_KEY_LENGTH
        or not key.isascii()
        or not key.isprintable()
        or any(part in ("", ".", "..") for part in parts)
    ):
        raise StorageKeyError("unsafe object key")
    return key


def _md5(data: bytes) -> str:
    return base64.b64encode(hashlib.md5(data, usedforsecurity=False).digest()).decode()


class GcsObjectStorage:
    def __init__(self, bucket: _Bucket) -> None:
        self._bucket = bucket

    @classmethod
    def for_bucket(cls, project: str, bucket_name: str) -> GcsObjectStorage:
        from google.cloud import storage  # type: ignore[attr-defined]  # ships no py.typed

        client = storage.Client(project=project)
        return cls(client.bucket(bucket_name))

    def check_private(self) -> None:
        self._bucket.reload()
        iam = self._bucket.iam_configuration
        if (
            iam.public_access_prevention != "enforced"
            or not iam.uniform_bucket_level_access_enabled
        ):
            raise PublicBucketError(
                f"bucket {self._bucket.name!r} must enforce public access prevention and "
                "uniform bucket-level access"
            )

    def put(self, key: str, data: bytes, *, content_type: str) -> None:
        blob = self._bucket.blob(validate_key(key))
        try:
            blob.upload_from_string(data, content_type=content_type, if_generation_match=0)
        except gexc.PreconditionFailed:
            existing = self._bucket.get_blob(key)
            if existing is None or existing.md5_hash != _md5(data):
                raise ObjectConflictError("object already exists with different content") from None

    def get(self, key: str, *, max_bytes: int) -> bytes:
        blob = self._bucket.get_blob(validate_key(key))
        if blob is None:
            raise ObjectNotFoundError(key)
        if blob.size is None or blob.size > max_bytes:
            raise ObjectTooLargeError(key)
        try:
            return blob.download_as_bytes(if_generation_match=blob.generation)
        except gexc.NotFound:
            raise ObjectNotFoundError(key) from None

    def exists(self, key: str) -> bool:
        return self._bucket.blob(validate_key(key)).exists()
