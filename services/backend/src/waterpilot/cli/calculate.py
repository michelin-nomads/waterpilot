"""Local, read-only CSV calculation preflight. No emulator or credentials required."""

import argparse
import sys
from pathlib import Path

from waterpilot.application.artifacts import CSV, JSON, MAX_BYTES
from waterpilot.application.calculations import CalculationInputs, calculate_csv, calculation_json
from waterpilot.domain.sources import SourceManifest


def _read(path: str, limit: int) -> bytes:
    with Path(path).open("rb") as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError(f"{Path(path).name} exceeds the {limit}-byte limit")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--inputs", required=True)
    args = parser.parse_args(argv)
    try:
        manifest = SourceManifest.model_validate_json(_read(args.manifest, MAX_BYTES[JSON]))
        inputs = CalculationInputs.model_validate_json(_read(args.inputs, MAX_BYTES[JSON]))
        result = calculate_csv(_read(args.csv, MAX_BYTES[CSV]), manifest, inputs)
        print(calculation_json(result), end="")
    except (ValueError, OSError) as err:
        print(f"[calculate] {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
