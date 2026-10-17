"""Value-object invariants (units, money, availability), opaque ids and emulator
token verification."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

from waterpilot.adapters.auth_emulator import EmulatorTokenVerifier
from waterpilot.application.identity import AccountKind
from waterpilot.domain.errors import DomainError, ErrorCode
from waterpilot.domain.ids import IdKind, new_id, require_id
from waterpilot.domain.values import (
    Availability,
    MeasuredValue,
    Money,
    MoneyRange,
    Quantity,
    Unit,
    currency_exponent,
)

FIXTURE = Path(__file__).resolve().parents[4] / "docs/domain/fixtures/synthetic-sample.input.json"


def test_inr_paise_fixtures_map_one_to_one_to_minor_units() -> None:
    economics = json.loads(FIXTURE.read_text())["economics"]
    for key in ("projectCostPaise", "omCostPaisePerYear"):
        paise = economics[key]
        money = Money.from_inr_paise(paise)
        assert money.currency == "INR" and money.exponent == 2
        assert int(money.minor_units) == paise  # carried over, never rescaled


def test_minor_unit_exponents_are_explicit() -> None:
    assert (currency_exponent("INR"), currency_exponent("JPY"), currency_exponent("KWD")) == (
        2,
        0,
        3,
    )
    with pytest.raises(DomainError) as exc:
        currency_exponent("XYZ")
    assert exc.value.code is ErrorCode.UNSUPPORTED_CURRENCY


def test_no_arithmetic_across_currencies() -> None:
    inr, usd = Money(minor_units="100", currency="INR"), Money(minor_units="100", currency="USD")
    assert (inr + inr).minor_units == "200"
    with pytest.raises(DomainError) as exc:
        _ = inr + usd
    assert exc.value.code is ErrorCode.CURRENCY_MISMATCH
    with pytest.raises(ValidationError):
        MoneyRange(low=inr, high=usd)


@pytest.mark.parametrize("bad", ["12.5", "1e9", "", "01", "1_000"])
def test_money_is_integer_minor_units(bad: str) -> None:
    with pytest.raises(ValidationError):
        Money(minor_units=bad, currency="INR")


def test_rates_are_exact_litres_per_day_strings() -> None:
    q = Quantity.litres_per_day("1250000.5")
    assert q.unit is Unit.LITRES_PER_DAY and q.value == "1250000.5"
    assert "MLD" not in {u.value for u in Unit}
    for bad in ("1e6", "1,000", "NaN", "Infinity", ".5"):
        with pytest.raises(ValidationError):
            Quantity.litres_per_day(bad)
    with pytest.raises(ValidationError):
        Quantity.model_validate({"value": "1250000", "unit": "MLD"})


def test_ratios_are_bounded() -> None:
    Quantity(value="0.25", unit=Unit.RATIO)
    with pytest.raises(ValidationError):
        Quantity(value="1.5", unit=Unit.RATIO)


def test_unavailable_is_never_zero() -> None:
    with pytest.raises(ValidationError):
        MeasuredValue(availability=Availability.UNAVAILABLE)  # no reason
    with pytest.raises(ValidationError):
        MeasuredValue(
            availability=Availability.UNAVAILABLE,
            reason="no source",
            quantity=Quantity.litres_per_day("0"),
        )
    with pytest.raises(ValidationError):
        MeasuredValue(availability=Availability.PROVISIONAL, quantity=Quantity.litres_per_day("5"))
    assert MeasuredValue.unavailable("no source").quantity is None


def test_ids_are_opaque_and_kind_checked() -> None:
    a, b = new_id(IdKind.SESSION), new_id(IdKind.SESSION)
    assert a != b and a.startswith("ses_") and len(a) == 30
    assert require_id(a, IdKind.SESSION) == a
    for bad in (a.replace("ses_", "rep_"), "ses_short", "../../etc", a.lower()):
        with pytest.raises(DomainError) as exc:
            require_id(bad, IdKind.SESSION)
        assert exc.value.code is ErrorCode.VALIDATION_FAILED


# --- emulator token verification ----------------------------------------------------

NOW = datetime(2026, 10, 10, tzinfo=UTC)


def _b64(data: dict[str, object]) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")


def _token(alg: str = "none", **overrides: object) -> str:
    claims: dict[str, object] = {
        "iss": "https://securetoken.google.com/demo-waterpilot",
        "aud": "demo-waterpilot",
        "sub": "user-1",
        "iat": int(NOW.timestamp()) - 10,
        "auth_time": int(NOW.timestamp()) - 10,
        "exp": int(NOW.timestamp()) + 3600,
        "firebase": {"sign_in_provider": "anonymous"},
    }
    claims.update(overrides)
    return f"{_b64({'alg': alg, 'typ': 'JWT'})}.{_b64(claims)}."


def test_emulator_verifier_accepts_valid_emulator_tokens() -> None:
    verifier = EmulatorTokenVerifier("demo-waterpilot", lambda: NOW)
    guest = verifier.verify(_token())
    assert guest.uid == "user-1" and guest.kind is AccountKind.GUEST
    google = verifier.verify(_token(firebase={"sign_in_provider": "google.com"}))
    assert google.kind is AccountKind.PERMANENT


@pytest.mark.parametrize(
    "token",
    [
        _token(alg="RS256"),
        _token(aud="real-project"),
        _token(iss="https://securetoken.google.com/real-project"),
        _token(exp=int(NOW.timestamp()) - 1),
        _token(sub=""),
        _token(firebase={}),
        _token(auth_time=None),
        _token(auth_time=int(NOW.timestamp()) + 3600),
        "not-a-jwt",
        "a.b.c",
    ],
)
def test_emulator_verifier_rejects_invalid_tokens(token: str) -> None:
    verifier = EmulatorTokenVerifier("demo-waterpilot", lambda: NOW)
    with pytest.raises(DomainError) as exc:
        verifier.verify(token)
    assert exc.value.code is ErrorCode.UNAUTHENTICATED


def test_emulator_verifier_refuses_real_projects() -> None:
    with pytest.raises(ValueError):
        EmulatorTokenVerifier("waterpilot-pilot", lambda: NOW)
