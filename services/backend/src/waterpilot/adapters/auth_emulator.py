"""Identity verifier for Firebase Auth **emulator** tokens (local mode only).

The emulator issues unsigned ID tokens (``alg: none``). They prove nothing outside a
local demo project, so this verifier refuses to exist for any non ``demo-*`` project
and the factory never builds it in pilot mode (pilot uses ``auth_firebase``).

Like the Admin SDK's ``check_revoked=True``, every token is also checked against the
account itself: a deleted or disabled account, or a token issued before the account's
sessions were revoked (``iat`` before ``validSince``), is rejected. The lookup only ever
talks to the configured emulator host, which settings restrict to loopback (or an
explicitly allowed name).
"""

from __future__ import annotations

import base64
import binascii
import json
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from waterpilot.application.identity import Principal, account_kind
from waterpilot.domain.errors import DomainError, ErrorCode

_CLOCK_SKEW_SECONDS = 60
_MAX_TOKEN_LENGTH = 8192


def unauthenticated() -> DomainError:
    return DomainError(ErrorCode.UNAUTHENTICATED, "your sign-in has expired or is invalid")


@dataclass(frozen=True, slots=True)
class AccountStatus:
    disabled: bool
    valid_since: datetime | None


class AccountLookup(Protocol):
    def status(self, uid: str) -> AccountStatus | None:
        """The account's state, or ``None`` if it does not exist."""
        ...


class EmulatorAccountLookup:
    """Reads account state through the Auth emulator's admin REST API."""

    def __init__(self, host: str, project_id: str, timeout_seconds: float = 3.0) -> None:
        if not project_id.startswith("demo-"):
            raise ValueError("emulator account lookup is only valid for demo-* projects")
        self._url = (
            f"http://{host}/identitytoolkit.googleapis.com/v1/projects/{project_id}/accounts:lookup"
        )
        self._timeout = timeout_seconds

    def status(self, uid: str) -> AccountStatus | None:
        request = urllib.request.Request(  # noqa: S310 - fixed http URL to the local emulator
            self._url,
            data=json.dumps({"localId": [uid]}).encode(),
            headers={"Authorization": "Bearer owner", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:  # noqa: S310
                body: dict[str, Any] = json.load(response)
        except (urllib.error.URLError, OSError, ValueError):
            raise DomainError(
                ErrorCode.SERVICE_UNAVAILABLE, "the local Auth emulator is not reachable"
            ) from None
        users = body.get("users") or []
        if not users:
            return None
        user = users[0]
        valid_since = user.get("validSince")
        return AccountStatus(
            disabled=bool(user.get("disabled", False)),
            valid_since=datetime.fromtimestamp(int(valid_since), UTC) if valid_since else None,
        )


def _number(value: object) -> float | None:
    """A numeric JWT claim; booleans are not numbers here."""
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)


def _segment(value: str) -> dict[str, Any]:
    try:
        decoded = json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        raise unauthenticated() from None
    if not isinstance(decoded, dict):
        raise unauthenticated()
    return decoded


class EmulatorTokenVerifier:
    def __init__(
        self,
        project_id: str,
        clock: Callable[[], datetime],
        accounts: AccountLookup | None = None,
    ) -> None:
        if not project_id.startswith("demo-"):
            raise ValueError("the emulator verifier is only valid for demo-* projects")
        self._project = project_id
        self._clock = clock
        self._accounts = accounts

    def verify(self, token: str) -> Principal:
        if not token or len(token) > _MAX_TOKEN_LENGTH or token.count(".") != 2:
            raise unauthenticated()
        header_raw, payload_raw, _signature = token.split(".")
        header, claims = _segment(header_raw), _segment(payload_raw)
        if header.get("alg") != "none":
            raise unauthenticated()
        now = self._clock().timestamp()
        uid = claims.get("sub")
        exp, iat = _number(claims.get("exp")), _number(claims.get("iat"))
        auth_time = _number(claims.get("auth_time"))
        firebase = claims.get("firebase")
        if (
            claims.get("aud") != self._project
            or claims.get("iss") != f"https://securetoken.google.com/{self._project}"
            or not isinstance(uid, str)
            or not 1 <= len(uid) <= 128
            or exp is None
            or iat is None
            or auth_time is None
            or exp <= now
            or iat > now + _CLOCK_SKEW_SECONDS
            or auth_time > now + _CLOCK_SKEW_SECONDS
            or not isinstance(firebase, dict)
        ):
            raise unauthenticated()
        provider = str(firebase.get("sign_in_provider", ""))
        if not provider:
            raise unauthenticated()
        signed_in = datetime.fromtimestamp(auth_time, UTC)
        if self._accounts is not None:
            status = self._accounts.status(uid)
            if status is None or status.disabled:
                raise unauthenticated()
            # Same rule as the Admin SDK's check_revoked: the token's issue time, not the
            # original sign-in time (linking keeps auth_time but moves validSince).
            if status.valid_since is not None and iat < status.valid_since.timestamp():
                raise unauthenticated()
        return Principal(
            uid=uid, kind=account_kind(provider), provider=provider, auth_time=signed_in
        )
