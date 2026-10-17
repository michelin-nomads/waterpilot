"""Export the FastAPI OpenAPI document to a file for contract generation.

Usage:  uv run python -m waterpilot.api.export_openapi <output_path>

The schema is built from fixed, explicit settings that ignore process environment
variables and `.env` files, so the output is identical on every machine and does
not depend on (or validate) the developer's runtime configuration. No adapters are
constructed and no services are contacted.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, PydanticBaseSettingsSource

from waterpilot.api.main import create_app
from waterpilot.config import LOCAL_DEMO_PROJECT, AppMode, Settings


class _SchemaExportSettings(Settings):
    """Settings populated only from constructor arguments."""

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (init_settings,)


def build_openapi() -> dict[str, Any]:
    settings = _SchemaExportSettings(
        app_mode=AppMode.LOCAL,
        use_emulators=True,
        gcp_project=LOCAL_DEMO_PROJECT,
        firestore_emulator_host="127.0.0.1:8080",
        auth_emulator_host="127.0.0.1:9099",
    )
    return create_app(settings).openapi()


def export(output_path: str) -> Path:
    out = Path(output_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(build_openapi(), indent=2) + "\n", encoding="utf-8")
    return out


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m waterpilot.api.export_openapi <output_path>")
    written = export(sys.argv[1])
    print(f"wrote OpenAPI document to {written}")


if __name__ == "__main__":
    main()
