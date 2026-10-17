"""Trivial pure-domain example used to prove the domain layer + its unit test.

Real water-balance and economic functions arrive in Phase 09+.
"""

from __future__ import annotations


def service_name() -> str:
    """Return the canonical service name (pure, deterministic)."""
    return "waterpilot"
