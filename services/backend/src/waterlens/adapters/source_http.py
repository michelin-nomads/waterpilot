"""HTTPS reader for approved publisher URLs (ADR 0008).

Built only by the operator command when ``--allow-network`` is given; the API and worker
never construct it, and tests pass an ``httpx.MockTransport``. It refuses non-https
URLs, does not follow redirects (a redirect could leave the registered host), sends no
credentials, and stops reading once a body exceeds the caller's limit.
"""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable, Sequence
from urllib.parse import urlsplit

import httpx

from waterlens.application.ports import FetchedObject, FetchError

USER_AGENT = "WaterLens-ingestion/0.1 (+operator import; contact via repository owner)"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)


class HttpSourceFetcher:
    def __init__(
        self,
        transport: httpx.BaseTransport | None = None,
        *,
        resolve_host: Callable[[str, int], Sequence[str]] | None = None,
    ) -> None:
        self._resolve_host = resolve_host or _resolve_host
        self._client = httpx.Client(
            transport=transport,
            timeout=TIMEOUT,
            follow_redirects=False,
            trust_env=False,
            headers={"User-Agent": USER_AGENT},
        )

    def _check(self, url: str) -> None:
        try:
            parts = urlsplit(url)
            port = parts.port
        except ValueError:
            raise FetchError("URL is invalid") from None
        host = parts.hostname or ""
        if parts.scheme != "https" or not host:
            raise FetchError("only https URLs are fetched")
        if parts.username or parts.password or port not in {None, 443}:
            raise FetchError("URL credentials and non-standard ports are not allowed")
        try:
            addresses = self._resolve_host(host, port or 443)
            if not addresses or any(not _is_public_address(value) for value in addresses):
                raise FetchError("URL resolves to a non-public address")
        except FetchError:
            raise
        except (OSError, ValueError):
            raise FetchError("URL host could not be verified as public") from None

    def probe(self, url: str) -> int:
        self._check(url)
        try:
            with self._client.stream("GET", url) as response:
                return response.status_code
        except httpx.HTTPError as err:
            raise FetchError(f"{type(err).__name__}: request failed") from None

    def fetch(self, url: str, *, max_bytes: int) -> FetchedObject:
        self._check(url)
        try:
            with self._client.stream("GET", url) as response:
                if response.status_code != 200:
                    raise FetchError(f"HTTP {response.status_code}", response.status_code)
                chunks: list[bytes] = []
                size = 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise FetchError(f"the file is larger than {max_bytes} bytes", 200)
                    chunks.append(chunk)
                return FetchedObject(
                    data=b"".join(chunks),
                    status=response.status_code,
                    content_type=response.headers.get("content-type"),
                )
        except httpx.HTTPError as err:
            raise FetchError(f"{type(err).__name__}: request failed") from None

    def close(self) -> None:
        self._client.close()


def _resolve_host(host: str, port: int) -> tuple[str, ...]:
    return tuple(
        str(address[4][0])
        for address in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    )


def _is_public_address(value: str) -> bool:
    address = ipaddress.ip_address(value.split("%", 1)[0])
    return address.is_global
