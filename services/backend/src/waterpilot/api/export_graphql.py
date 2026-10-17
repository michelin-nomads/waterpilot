"""Export the GraphQL schema (SDL) for ``packages/contracts/schema.graphql``.

The SDL does not depend on settings or the environment; introspection being
disabled in pilot mode changes runtime behaviour, not the schema.

Usage:  uv run python -m waterpilot.api.export_graphql ../../packages/contracts/schema.graphql
"""

from __future__ import annotations

import sys
from pathlib import Path

from waterpilot.api.graphql.schema import schema_sdl


def export(path: Path) -> None:
    path.write_text(schema_sdl(), encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m waterpilot.api.export_graphql <output.graphql>")
    export(Path(sys.argv[1]))
