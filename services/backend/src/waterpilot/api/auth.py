"""Resolve the caller from the ``Authorization`` header for GraphQL and HTTP routes."""

from __future__ import annotations

from fastapi import Request

from waterpilot.api.runtime import http_error
from waterpilot.application.identity import IdentityVerifier, Principal
from waterpilot.domain.errors import DomainError, ErrorCode


def resolve_principal(
    request: Request, authorization: str | None, verifier: IdentityVerifier
) -> Principal | None:
    """No header, a malformed header or a rejected token all mean "no principal", so any
    operation needing identity fails with ``UNAUTHENTICATED`` and the client refreshes or
    signs in again. A verifier that cannot reach its key or account source answers 503
    instead: that is not the caller's fault and must not look like a sign-out.

    Blocking (the verifier may call the Auth backend); run it off the event loop."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    try:
        return verifier.verify(token.strip())
    except DomainError as err:
        if err.code is ErrorCode.UNAUTHENTICATED:
            return None
        raise http_error(err, request) from None
