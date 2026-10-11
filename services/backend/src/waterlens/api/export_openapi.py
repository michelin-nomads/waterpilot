"""Export the FastAPI OpenAPI document to a file for contract generation.

Usage:  uv run python -m waterlens.api.export_openapi <output_path>
Writing from the app is deterministic and requires no running server.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from waterlens.api.main import create_app
from waterlens.config import AppMode, Settings


def export(output_path: str) -> Path:
    # Build the app with explicit local settings so export never depends on env.
    app = create_app(Settings(app_mode=AppMode.LOCAL, use_emulators=True))
    out = Path(output_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    return out


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m waterlens.api.export_openapi <output_path>")
    written = export(sys.argv[1])
    print(f"wrote OpenAPI document to {written}")


if __name__ == "__main__":
    main()
