from __future__ import annotations

import json
from pathlib import Path

from waterpilot.cli.intervention_catalogue import render
from waterpilot.domain.interventions import CATALOGUE, Catalogue

DOC = Path(__file__).resolve().parents[4] / "docs" / "domain" / "interventions.catalogue.json"


def test_committed_catalogue_matches_runtime() -> None:
    assert DOC.read_text(encoding="utf-8") == render(), "run `npm run intervention-catalogue`"


def test_committed_catalogue_loads_and_keeps_its_version() -> None:
    loaded = Catalogue.model_validate(json.loads(DOC.read_text(encoding="utf-8")))
    assert loaded == CATALOGUE and loaded.version == "interventions-3"
