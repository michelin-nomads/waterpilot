"""Local filesystem object storage adapter (development and tests only).

Stands in for the private Cloud Storage bucket with the same contract: keys are
relative POSIX-style paths confined to the base directory, objects are create-only
(identical bytes again are a no-op, different bytes conflict), and reads check the size
before loading. Writes go to a temporary file first and are linked into place, so a
crash never leaves a partial object. Content types are not stored locally.
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

from waterpilot.application.ports import (
    ObjectConflictError,
    ObjectNotFoundError,
    ObjectTooLargeError,
    StorageKeyError,
)

__all__ = ["LocalObjectStorage", "StorageKeyError"]


@dataclass(slots=True)
class LocalObjectStorage:
    base_dir: Path

    def __post_init__(self) -> None:
        self.base_dir = Path(self.base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        if not key or key.startswith("/") or ".." in Path(key).parts:
            raise StorageKeyError(f"unsafe object key: {key!r}")
        target = (self.base_dir / key).resolve()
        if self.base_dir not in target.parents:
            raise StorageKeyError(f"key escapes storage root: {key!r}")
        return target

    def put(self, key: str, data: bytes, *, content_type: str) -> None:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(dir=target.parent, prefix=".tmp-", suffix=".partial")
        tmp = Path(tmp_name)
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
                fh.flush()
                os.fsync(fh.fileno())
            try:
                os.link(tmp, target)  # fails if the key exists: never replaces an object
            except FileExistsError:
                if target.read_bytes() != data:
                    raise ObjectConflictError(f"object already exists: {key!r}") from None
        finally:
            tmp.unlink(missing_ok=True)

    def get(self, key: str, *, max_bytes: int) -> bytes:
        target = self._resolve(key)
        try:
            if target.stat().st_size > max_bytes:
                raise ObjectTooLargeError(key)
            return target.read_bytes()
        except FileNotFoundError:
            raise ObjectNotFoundError(key) from None

    def exists(self, key: str) -> bool:
        return self._resolve(key).is_file()
