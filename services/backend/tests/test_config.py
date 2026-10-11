"""Fail-closed configuration behaviour."""

from __future__ import annotations

import pytest

from waterlens.config import AppMode, ConfigError, Settings


def test_local_mode_valid() -> None:
    s = Settings(app_mode=AppMode.LOCAL, use_emulators=True)
    assert s.is_pilot is False


def test_local_mode_requires_emulators() -> None:
    with pytest.raises(ConfigError):
        Settings(app_mode=AppMode.LOCAL, use_emulators=False)


def test_pilot_mode_rejects_emulators() -> None:
    with pytest.raises(ConfigError):
        Settings(app_mode=AppMode.PILOT, use_emulators=True, gcp_project="real-proj")


def test_pilot_mode_rejects_demo_project() -> None:
    with pytest.raises(ConfigError):
        Settings(
            app_mode=AppMode.PILOT,
            use_emulators=False,
            firestore_emulator_host=None,
            auth_emulator_host=None,
            gcp_project="demo-waterlens",
        )


def test_pilot_mode_valid() -> None:
    s = Settings(
        app_mode=AppMode.PILOT,
        use_emulators=False,
        firestore_emulator_host=None,
        auth_emulator_host=None,
        gcp_project="waterlens-prod",
    )
    assert s.is_pilot is True
