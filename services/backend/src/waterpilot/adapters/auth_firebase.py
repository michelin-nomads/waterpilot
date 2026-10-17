"""Production identity verifier: Firebase Admin SDK (pilot mode only).

``verify_id_token`` checks the RS256 signature against Google's published keys, the
audience/issuer for this project, expiry and issue time; ``check_revoked=True`` also
rejects disabled accounts and tokens issued before a revocation. Credentials come from
Application Default Credentials on Cloud Run; no key file is read or accepted.

The Admin SDK silently accepts **unsigned** tokens whenever
``FIREBASE_AUTH_EMULATOR_HOST`` is set, so this verifier refuses to exist if it is.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any

from waterpilot.adapters.auth_emulator import unauthenticated
from waterpilot.application.identity import Principal, account_kind
from waterpilot.domain.errors import DomainError, ErrorCode

type VerifyIdToken = Callable[[str], Mapping[str, Any]]

_APP_NAME = "waterpilot-auth"
_EMULATOR_ENV = "FIREBASE_AUTH_EMULATOR_HOST"


def admin_sdk_verify(
    project_id: str, credential: Any = None, app_name: str = _APP_NAME
) -> VerifyIdToken:
    """Bind ``firebase_admin.auth.verify_id_token`` to a dedicated app for the project.
    ``credential`` defaults to Application Default Credentials (resolved on first use)."""
    import firebase_admin
    from firebase_admin import auth

    try:
        app = firebase_admin.get_app(app_name)
    except ValueError:
        app = firebase_admin.initialize_app(
            credential, options={"projectId": project_id}, name=app_name
        )

    def verify(token: str) -> Mapping[str, Any]:
        claims: Mapping[str, Any] = auth.verify_id_token(token, app=app, check_revoked=True)
        return claims

    return verify


class FirebaseAdminTokenVerifier:
    def __init__(
        self,
        project_id: str,
        verify_id_token: VerifyIdToken | None = None,
        environ: Mapping[str, str] = os.environ,
    ) -> None:
        if project_id.startswith("demo-"):
            raise ValueError("the Admin SDK verifier needs a real project, not demo-*")
        if environ.get(_EMULATOR_ENV):
            raise ValueError(f"{_EMULATOR_ENV} is set; refusing to verify tokens in pilot mode")
        self._verify = verify_id_token or admin_sdk_verify(project_id)

    def verify(self, token: str) -> Principal:
        from firebase_admin import auth, exceptions

        try:
            claims = self._verify(token)
        except (
            auth.CertificateFetchError,
            exceptions.UnavailableError,
            exceptions.DeadlineExceededError,
            exceptions.InternalError,
            exceptions.UnknownError,
        ):
            # Google could not be reached: not the caller's fault, so not a sign-out.
            raise DomainError(
                ErrorCode.SERVICE_UNAVAILABLE, "sign-in cannot be checked right now; try again"
            ) from None
        except (ValueError, exceptions.FirebaseError):
            # Expired, revoked, malformed, wrong project, disabled or deleted account.
            raise unauthenticated() from None
        uid = claims.get("uid") or claims.get("sub")
        firebase = claims.get("firebase")
        auth_time = claims.get("auth_time")
        if (
            not isinstance(uid, str)
            or not isinstance(firebase, Mapping)
            or not isinstance(auth_time, int | float)
        ):
            raise unauthenticated()
        provider = str(firebase.get("sign_in_provider", ""))
        if not provider:
            raise unauthenticated()
        return Principal(
            uid=uid,
            kind=account_kind(provider),
            provider=provider,
            auth_time=datetime.fromtimestamp(auth_time, UTC),
        )
