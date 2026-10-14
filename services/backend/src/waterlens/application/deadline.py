"""Cooperative deadlines propagated into synchronous work through to_thread."""

import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from waterlens.domain.errors import DomainError, ErrorCode

deadline: ContextVar[float | None] = ContextVar("deadline", default=None)


def remaining() -> float:
    end = deadline.get()
    seconds = 30.0 if end is None else end - time.monotonic()
    if seconds <= 0:
        raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "request deadline reached; reconnect")
    return seconds


@contextmanager
def bounded(seconds: float) -> Iterator[None]:
    parent = deadline.get()
    end = time.monotonic() + seconds
    token = deadline.set(min(parent, end) if parent is not None else end)
    try:
        yield
    finally:
        deadline.reset(token)


class DeadlineRpc:
    """Keep SDK RPC retries within the caller's deadline, including begin/commit."""

    def __init__(self, rpc: Any) -> None:
        self.rpc = rpc

    def __getattr__(self, name: str) -> Any:
        fn = getattr(self.rpc, name)
        if not callable(fn):
            return fn

        def call(*args: Any, **kwargs: Any) -> Any:
            if deadline.get() is not None:
                kwargs["timeout"] = min(kwargs.get("timeout") or 30.0, remaining())
                kwargs["retry"] = None
            return fn(*args, **kwargs)

        return call


def bound_client(client: Any) -> None:
    rpc = client._firestore_api
    if not isinstance(rpc, DeadlineRpc):
        client._firestore_api_internal = DeadlineRpc(rpc)
