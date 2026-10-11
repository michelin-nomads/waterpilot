"""Local filesystem object storage adapter (dev only).

Stands in for private Cloud Storage during local development. Keys are treated as
relative POSIX-style paths; traversal outside the base directory is rejected.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


class StorageKeyError(ValueError):
    """Raised for unsafe or empty object keys."""


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
        if self.base_dir not in target.parents and target != self.base_dir:
            raise StorageKeyError(f"key escapes storage root: {key!r}")
        return target

    def put(self, key: str, data: bytes) -> None:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def get(self, key: str) -> bytes:
        return self._resolve(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._resolve(key).is_file()
