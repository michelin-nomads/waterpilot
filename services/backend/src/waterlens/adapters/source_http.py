"""HTTPS reader for approved publisher URLs (ADR 0008).

Built only by the operator command when ``--allow-network`` is given; the API and worker
never construct it, and tests pass an ``httpx.MockTransport``. It refuses non-https
URLs, does not follow redirects (a redirect could leave the registered host), sends no
credentials, and stops reading once a body exceeds the caller's limit.
"""

from __future__ import annotations

from urllib.parse import urlsplit

import httpx

from waterlens.application.ports import FetchedObject, FetchError

USER_AGENT = "WaterLens-ingestion/0.1 (+operator import; contact via repository owner)"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)


class HttpSourceFetcher:
    def __init__(self, transport: httpx.BaseTransport | None = None) -> None:
        self._client = httpx.Client(
            transport=transport,
            timeout=TIMEOUT,
            follow_redirects=False,
            headers={"User-Agent": USER_AGENT},
        )

    @staticmethod
    def _check(url: str) -> None:
        if urlsplit(url).scheme != "https":
            raise FetchError("only https URLs are fetched")

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
