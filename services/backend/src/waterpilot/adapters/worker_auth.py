"""Verification of Google-signed OIDC tokens on private worker requests (cloud mode).

Cloud Tasks, Eventarc and Cloud Scheduler call the worker with an ID token for a
dedicated service account. Cloud Run IAM (invoker role, no unauthenticated access)
rejects other callers at the edge; this check repeats it in the application so a
misconfigured service still refuses them: signature against Google's published
certificates, issuer, audience (the worker URL), and a verified email that is one of
the configured invoker service accounts.
"""

from __future__ import annotations

import json
import threading
import time
from collections.abc import Callable, Mapping
from typing import Any

from google.auth import exceptions as gauth_exc
from google.auth import jwt

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v1/certs"
GOOGLE_ISSUERS = frozenset({"https://accounts.google.com", "accounts.google.com"})
CERT_TTL_SECONDS = 3600.0
MIN_REFRESH_SECONDS = 60.0
CLOCK_SKEW_SECONDS = 10


class InvokerRejectedError(Exception):
    def __init__(self, status: int, reason: str) -> None:
        super().__init__(reason)
        self.status = status


type CertFetcher = Callable[[], Mapping[str, str]]


def google_cert_fetcher() -> CertFetcher:
    import google.auth.transport.requests

    request = google.auth.transport.requests.Request()

    def fetch() -> Mapping[str, str]:
        response = request(GOOGLE_CERTS_URL, method="GET")
        if response.status != 200:
            raise gauth_exc.TransportError(f"certificate fetch failed: {response.status}")  # type: ignore[no-untyped-call]
        certs: dict[str, str] = json.loads(response.data)
        return certs

    return fetch


class _CertCache:
    def __init__(self, fetch: CertFetcher, clock: Callable[[], float]) -> None:
        self._fetch = fetch
        self._clock = clock
        self._lock = threading.Lock()
        self._certs: Mapping[str, str] = {}
        self._fetched_at = float("-inf")

    def get(self, *, refresh: bool = False) -> Mapping[str, str]:
        with self._lock:
            age = self._clock() - self._fetched_at
            if age > CERT_TTL_SECONDS or (refresh and age > MIN_REFRESH_SECONDS):
                self._certs = self._fetch()
                self._fetched_at = self._clock()
            return self._certs


class GoogleOidcInvokerVerifier:
    def __init__(
        self,
        *,
        audience: str,
        allowed_emails: frozenset[str],
        fetch_certs: CertFetcher,
        clock: Callable[[], float] = time.time,
    ) -> None:
        if not audience or not allowed_emails:
            raise ValueError("an audience and at least one invoker service account are required")
        self._audience = audience
        self._allowed = allowed_emails
        self._certs = _CertCache(fetch_certs, clock)

    def _decode(self, token: str, *, refresh: bool) -> Mapping[str, Any]:
        claims: Mapping[str, Any] = jwt.decode(  # type: ignore[no-untyped-call]
            token,
            certs=self._certs.get(refresh=refresh),
            audience=self._audience,
            clock_skew_in_seconds=CLOCK_SKEW_SECONDS,
        )
        return claims

    def verify(self, token: str) -> str:
        """Return the invoker's service-account email or raise ``InvokerRejectedError``."""
        try:
            try:
                claims = self._decode(token, refresh=False)
            except ValueError:
                claims = self._decode(token, refresh=True)  # Google rotates its keys
        except (ValueError, gauth_exc.GoogleAuthError):
            raise InvokerRejectedError(401, "invalid invoker token") from None
        if claims.get("iss") not in GOOGLE_ISSUERS:
            raise InvokerRejectedError(401, "invalid invoker token")
        email = claims.get("email")
        if claims.get("email_verified") is not True or email not in self._allowed:
            raise InvokerRejectedError(403, "this caller may not invoke the worker")
        return str(email)
