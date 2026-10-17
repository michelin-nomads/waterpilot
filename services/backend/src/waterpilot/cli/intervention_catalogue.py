"""Generate ``docs/domain/interventions.catalogue.json`` from the runtime catalogue, so
the reviewable document cannot drift from what the API serves (drift test:
``tests/domain/test_intervention_catalogue_doc.py``).

Usage:  uv run python -m waterpilot.cli.intervention_catalogue <output.json>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from waterpilot.domain.interventions import CATALOGUE


def render() -> str:
    data = CATALOGUE.model_dump(mode="json")
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    Path(argv[0]).write_text(render(), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
